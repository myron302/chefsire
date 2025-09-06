Why you should do it regularly: https://github.com/browserslist/update-db#readme
✓ 7 modules transformed.
x Build failed in 1.25s
error during build:
[vite:esbuild] Transform failed with 1 error:
/opt/render/project/src/client/src/components/layout.tsx:15:30: ERROR: Unexpected "{"
file: /opt/render/project/src/client/src/components/layout.tsx:15:30
Unexpected "{"
13 |  import chefLogo from "../asset/logo.jpg";
14 |  
15 |  interface LayoutProps {import { useState, useEffect } from "react";
   |                                ^
16 |  import { Link, useLocation } from "wouter";
17 |  import { Input } from "@/components/ui/input";
    at failureErrorWithLog (/opt/render/project/src/node_modules/vite/node_modules/esbuild/lib/main.js:1472:15)
    at /opt/render/project/src/node_modules/vite/node_modules/esbuild/lib/main.js:755:50
    at responseCallbacks.<computed> (/opt/render/project/src/node_modules/vite/node_modules/esbuild/lib/main.js:622:9)
    at handleIncomingPacket (/opt/render/project/src/node_modules/vite/node_modules/esbuild/lib/main.js:677:12)
    at Socket.readFromStdout (/opt/render/project/src/node_modules/vite/node_modules/esbuild/lib/main.js:600:7)
    at Socket.emit (node:events:518:28)
    at addChunk (node:internal/streams/readable:561:12)
    at readableAddChunkPushByteMode (node:internal/streams/readable:512:3)
    at Readable.push (node:internal/streams/readable:392:5)
    at Pipe.onStreamRead (node:internal/stream_base_commons:189:23)
==> Build failed 😞
==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys
