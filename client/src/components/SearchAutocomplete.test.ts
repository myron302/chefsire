import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

test("autocomplete binds suggestions and submit navigation to current input and source", async () => {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const cache = join(repo, "node_modules/.cache");
  mkdirSync(cache, { recursive: true });
  const temp = mkdtempSync(join(cache, "autocomplete-"));
  const destinations: string[] = [];
  const pending: Array<{ url: string; signal: AbortSignal; resolve: (response: Response) => void }> = [];
  const empty = { users: [], recipes: [], drinks: [], reviews: [], petFoods: [] };
  const results = (name: string) => ({ ...empty, query: name, drinks: [{ id: name, name, type: "drink", route: `/drinks/${name}`, matchKind: "recipe-exact" }] });
  const globals = {
    document: new EventTarget(),
    __autocompleteTest: { navigate: (path: string) => destinations.push(path) },
    fetch: (url: string, options: RequestInit) => new Promise<Response>(resolve => {
      pending.push({ url, signal: options.signal as AbortSignal, resolve });
    }),
  };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true });
  let view: ReactTestRenderer | undefined;
  try {
    await build({
      entryPoints: [join(repo, "client/src/components/SearchAutocomplete.tsx")], outfile: join(temp, "search.mjs"),
      absWorkingDir: repo, bundle: true, packages: "external", platform: "node", format: "esm", jsx: "automatic",
      plugins: [{ name: "autocomplete-fixtures", setup(b) {
        b.onResolve({ filter: /^wouter$|components\/ui\/(input|avatar|use-toast)$|data\/pet-food\/canonical$/ }, ({ path }) => ({ path, namespace: "fixture" }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ loader: "js", resolveDir: repo, contents:
          path === "wouter" ? "export const useLocation=()=>['/',globalThis.__autocompleteTest.navigate];" :
          path.endsWith("use-toast") ? "export const useToast=()=>({toast(){}});" :
          path.endsWith("canonical") ? "export const resolveCanonicalPetFoodSlug=()=>null;" :
          path.endsWith("input") ? "import React from 'react';export const Input=React.forwardRef((p,ref)=>React.createElement('input',{...p,ref}));" :
          "import React from 'react';export const Avatar=p=>React.createElement('div',p);export const AvatarImage=p=>React.createElement('img',p);export const AvatarFallback=p=>React.createElement('div',p);",
        }));
      } }],
    });
    const { default: Search } = await import(pathToFileURL(join(temp, "search.mjs")).href);
    await act(async () => { view = create(React.createElement(Search)); });
    const input = () => view!.root.findByType("input");
    const type = async (value: string) => { await act(async () => input().props.onChange({ target: { value } })); };
    const debounce = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 330)); }); };
    const reply = async (index: number, name: string) => { await act(async () => pending[index].resolve(Response.json(results(name)))); };
    const submit = async () => { await act(async () => view!.root.findByType("form").props.onSubmit({ preventDefault() {} })); };
    const text = () => JSON.stringify(view!.toJSON());

    await type("coffee"); await debounce(); await reply(0, "coffee");
    assert.match(text(), /coffee/);
    await type("soup");
    await submit();
    assert.equal(destinations.at(-1), "/recipes?q=soup", "Enter during debounce must not navigate to the prior drink");
    await debounce();
    assert.equal(pending[0].signal.aborted, true);
    await type("salad"); await debounce();
    assert.equal(pending[1].signal.aborted, true);
    await reply(2, "salad"); await reply(1, "soup");
    assert.doesNotMatch(text(), /drinks\/soup/);
    await submit(); assert.equal(destinations.at(-1), "/drinks/salad");

    await act(async () => input().props.onFocus());
    await act(async () => view!.root.findAllByType("button").find(button => button.props.children === "External")!.props.onClick());
    await debounce();
    assert.match(pending[3].url, /source=external/);
    await type("");
    assert.equal(pending[3].signal.aborted, true);
    await reply(3, "obsolete-source");
    assert.doesNotMatch(text(), /obsolete-source|Searching\.\.\./);

    await type("failure"); await debounce();
    await act(async () => pending[4].resolve(Response.json({ error: "unavailable" }, { status: 503 })));
    assert.doesNotMatch(text(), /drinks\/salad/);
    await type("unmount"); await debounce();
    await act(async () => view!.unmount()); view = undefined;
    assert.equal(pending[5].signal.aborted, true);
  } finally {
    if (view) await act(async () => view!.unmount());
    rmSync(temp, { recursive: true, force: true });
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
