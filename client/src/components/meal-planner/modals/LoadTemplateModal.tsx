import React from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

type LoadTemplateModalProps = {
  open: boolean;
  onClose: () => void;
  onLoadTemplate: (templateName: string) => void;
};

const LoadTemplateModal = ({ open, onClose, onLoadTemplate }: LoadTemplateModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Save className="w-6 h-6 text-blue-500" />
            Load Template
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>

        <p className="text-gray-600 mb-6">Select a saved meal plan template to load:</p>

        <div className="space-y-3">
          {(() => {
            const templates = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key?.startsWith('meal-template-')) {
                templates.push(key.replace('meal-template-', ''));
              }
            }

            if (templates.length === 0) {
              return (
                <div className="text-center py-8 text-gray-500">
                  <Save className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No saved templates yet</p>
                  <p className="text-sm mt-1">Create a meal plan and click "Save Template" to save it</p>
                </div>
              );
            }

            return templates.map((templateName) => (
              <div
                key={templateName}
                className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                onClick={() => onLoadTemplate(templateName)}
              >
                <div>
                  <h4 className="font-medium">{templateName}</h4>
                  <p className="text-xs text-gray-500">Click to load</p>
                </div>
                <Button size="sm">Load</Button>
              </div>
            ));
          })()}
        </div>

        <Button variant="outline" className="w-full mt-6" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default LoadTemplateModal;
