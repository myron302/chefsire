import { Gift, Info, Link2, Mail, Plus, Share2, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { RegistryLink } from "@/pages/services/lib/wedding-planning-core";

interface WeddingPlanningRegistrySectionProps {
  isEditingRegistryLinks: boolean;
  registryLinks: RegistryLink[];
  registryDraft: RegistryLink[];
  onCancelRegistryEdit: () => void;
  onSaveRegistryLinks: () => void;
  onStartRegistryEdit: () => void;
  onRegistryUrlChange: (registryId: number, url: string) => void;
  onRemoveRegistry: (registryId: number) => void;
  onAddRegistry: () => void;
  onShareRegistry: (platform: string) => void;
  registrySlug: string | number;
}

export function WeddingPlanningRegistrySection({
  isEditingRegistryLinks,
  registryLinks,
  registryDraft,
  onCancelRegistryEdit,
  onSaveRegistryLinks,
  onStartRegistryEdit,
  onRegistryUrlChange,
  onRemoveRegistry,
  onAddRegistry,
  onShareRegistry,
  registrySlug,
}: WeddingPlanningRegistrySectionProps) {
  return (
    <Card className="mb-8">
      <CardHeader className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-pink-600 to-purple-600 flex items-center justify-center shadow-sm"><Gift className="w-4 h-4 text-white" /></div>
              Gift Registry Hub
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">Manage all your registries in one place and share with guests</CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {isEditingRegistryLinks ? (
              <>
                <Button size="sm" variant="outline" onClick={onCancelRegistryEdit}>
                  Cancel
                </Button>
                <Button size="sm" onClick={onSaveRegistryLinks}>
                  Save
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={onStartRegistryEdit}>
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <div className="space-y-3 md:space-y-4">
          {(isEditingRegistryLinks ? registryDraft : registryLinks).map((registry) => (
            <div key={registry.id} className="flex items-center gap-2 md:gap-3">
              <span className="text-xl md:text-2xl flex-shrink-0">{registry.icon}</span>
              <div className="flex-1 min-w-0">
                <Input
                  placeholder={`${registry.name} Registry URL`}
                  value={registry.url}
                  onChange={(e) => onRegistryUrlChange(registry.id, e.target.value)}
                  className="w-full text-sm"
                  disabled={!isEditingRegistryLinks}
                />
              </div>
              {isEditingRegistryLinks && (
                <Button size="sm" variant="ghost" className="flex-shrink-0" onClick={() => onRemoveRegistry(registry.id)} title="Remove">
                  <X className="w-3 h-3 md:w-4 md:h-4" />
                </Button>
              )}
            </div>
          ))}

          <Button variant="outline" className="w-full text-sm" onClick={onAddRegistry}>
            <Plus className="w-4 h-4 mr-2" />
            Add Another Registry
          </Button>

          {!isEditingRegistryLinks && (
            <p className="text-xs text-muted-foreground">
              Tap <span className="font-medium">Edit</span> to add or change registry links, then <span className="font-medium">Save</span>.
            </p>
          )}

          <div className="border-t pt-4 mt-4 md:mt-6">
            <h4 className="font-medium mb-3 text-sm md:text-base">Share Your Registries</h4>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={() => onShareRegistry("Facebook")}>
                <Share2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 text-blue-600" />
                <span className="hidden sm:inline">Facebook</span>
                <span className="sm:hidden">FB</span>
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => onShareRegistry("Instagram")}>
                <Share2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 text-pink-600" />
                <span className="hidden sm:inline">Instagram</span>
                <span className="sm:hidden">IG</span>
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => onShareRegistry("Email")}>
                <Mail className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 text-purple-600" />
                Email
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => onShareRegistry("copy")}>
                <Link2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 text-slate-700" />
                <span className="hidden sm:inline">Copy Link</span>
                <span className="sm:hidden">Copy</span>
              </Button>
            </div>

            <Alert className="mt-4">
              <Info className="h-3 w-3 md:h-4 md:w-4 text-purple-600" />
              <AlertDescription className="text-xs md:text-sm break-all">
                Your unique registry page: <strong>chefsire.com/registry/{registrySlug}</strong>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
