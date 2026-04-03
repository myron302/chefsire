import { Calendar as CalendarIcon, ChefHat, MapPin, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

interface WeddingPlanningInvitationPreviewProps {
  selectedTemplate: string;
  partner1Name: string;
  partner2Name: string;
  customMessage: string;
  selectedDate: string;
  weddingTime: string;
  weddingLocation: string;
  useSameLocation: boolean;
  receptionLocation: string;
  receptionTime: string;
  onRenderError: (error: unknown) => void;
}

export function WeddingPlanningInvitationPreview({
  selectedTemplate,
  partner1Name,
  partner2Name,
  customMessage,
  selectedDate,
  weddingTime,
  weddingLocation,
  useSameLocation,
  receptionLocation,
  receptionTime,
  onRenderError,
}: WeddingPlanningInvitationPreviewProps) {
  try {
    const styleTemplates = {
      elegant: {
        container: "bg-white font-serif border-double border-pink-200",
        accent: "text-pink-500",
        title: "font-light tracking-widest uppercase text-3xl",
        button: "rounded-full border-pink-200",
      },
      rustic: {
        container: "bg-orange-50 font-sans border-dashed border-amber-300",
        accent: "text-amber-700",
        title: "font-bold text-4xl italic text-amber-900",
        button: "rounded-none border-amber-500 bg-amber-50",
      },
      modern: {
        container: "bg-slate-900 text-white font-sans border-solid border-white/20",
        accent: "text-cyan-400",
        title: "font-black tracking-tighter text-5xl uppercase italic",
        button: "rounded-md border-cyan-400 text-cyan-400 hover:bg-cyan-400/10",
      },
    };

    const styles = (styleTemplates as any)[selectedTemplate] || styleTemplates.elegant;

    return (
      <div className={`p-8 rounded-lg text-center space-y-6 border-4 shadow-xl transition-all duration-500 ${styles.container}`}>
        <div className="space-y-2">
          <Sparkles className={`w-6 h-6 mx-auto ${styles.accent}`} />
          <h2 className={styles.title}>
            {partner1Name || "Partner 1"} <span className="text-xl block md:inline">&</span> {partner2Name || "Partner 2"}
          </h2>
          <div className={`h-px w-24 mx-auto opacity-50 ${selectedTemplate === "modern" ? "bg-cyan-400" : "bg-current"}`} />
        </div>

        <p className={`text-lg px-4 ${selectedTemplate === "modern" ? "text-slate-300" : "italic text-muted-foreground"}`}>"{customMessage}"</p>

        <div className="space-y-6 py-4">
          <div className="flex flex-col items-center">
            <CalendarIcon className={`w-5 h-5 mb-1 ${styles.accent}`} />
            <p className="font-semibold text-lg">{selectedDate || "Saturday, June 14th"}</p>
            <p className="text-sm opacity-80">{weddingTime || "4:00 PM"}</p>
          </div>

          <div className="flex flex-col items-center">
            <MapPin className={`w-5 h-5 mb-1 ${styles.accent}`} />
            <p className="font-bold uppercase tracking-widest text-xs mb-1">The Ceremony</p>
            <p className="text-sm max-w-xs">{weddingLocation || "The Grand Estate, Main Hall"}</p>
          </div>

          {!useSameLocation && receptionLocation ? (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500 pt-4 border-t border-current/10">
              <ChefHat className={`w-5 h-5 mb-1 ${styles.accent}`} />
              <p className="font-bold uppercase tracking-widest text-xs mb-1">The Reception</p>
              <p className="text-sm max-w-xs">{receptionLocation}</p>
              {receptionTime && <p className="text-xs opacity-70 mt-1">Dinner served at {receptionTime}</p>}
            </div>
          ) : useSameLocation ? (
            <div className="pt-4 border-t border-current/10">
              <p className={`text-xs uppercase tracking-[0.2em] font-medium ${styles.accent}`}>Dinner & Dancing to follow at the same venue</p>
            </div>
          ) : null}
        </div>

        <Button variant="outline" className={`pointer-events-none px-10 ${styles.button}`}>
          RSVP Online
        </Button>
      </div>
    );
  } catch (error) {
    onRenderError(error);
    return <div className="p-8 text-center text-red-500">Error rendering preview</div>;
  }
}
