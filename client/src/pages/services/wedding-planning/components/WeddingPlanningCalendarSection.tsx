import { BellRing, Calendar, Calendar as CalendarIcon, Clock, Plus, TrendingUp, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { WEDDING_EVENT_TYPE_OPTIONS, formatWeddingEventTypeLabel, weddingEventTypeVariant } from "@/pages/services/lib/wedding-planning-core";

interface CalendarEvent {
  id: number;
  date: string;
  time?: string;
  title: string;
  type: string;
  reminder: boolean;
  notes?: string;
}

interface WeddingPlanningCalendarSectionProps {
  calendarDate: Date | undefined;
  setCalendarDate: (date: Date | undefined) => void;
  calendarEventDates: Date[];
  sortedCalendarEvents: CalendarEvent[];
  parseCalendarDate: (date: string) => Date;
  buildGoogleCalendarUrl: (event: { title: string; date: Date; time?: string; notes?: string }) => string;
  handleRemoveCalendarEvent: (eventId: number) => void;
  normalizeCalendarDate: (date: Date) => string;
  calendarEventTime: string;
  setCalendarEventTime: (value: string) => void;
  calendarTitle: string;
  setCalendarTitle: (value: string) => void;
  calendarType: string;
  setCalendarType: (value: string) => void;
  calendarNotes: string;
  setCalendarNotes: (value: string) => void;
  calendarReminder: boolean;
  setCalendarReminder: (value: boolean) => void;
  handleAddCalendarEvent: () => void;
}

export function WeddingPlanningCalendarSection({
  calendarDate,
  setCalendarDate,
  calendarEventDates,
  sortedCalendarEvents,
  parseCalendarDate,
  buildGoogleCalendarUrl,
  handleRemoveCalendarEvent,
  normalizeCalendarDate,
  calendarEventTime,
  setCalendarEventTime,
  calendarTitle,
  setCalendarTitle,
  calendarType,
  setCalendarType,
  calendarNotes,
  setCalendarNotes,
  calendarReminder,
  setCalendarReminder,
  handleAddCalendarEvent,
}: WeddingPlanningCalendarSectionProps) {
  return (
    <Card className="mb-8">
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-sm">
            <CalendarIcon className="w-4 h-4 text-white" />
          </div>
          Planning Calendar
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">Track important dates, appointments, and deadlines</CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div>
            <div className="mb-4 md:mb-6">
              <CalendarUI
                mode="single"
                selected={calendarDate}
                onSelect={(date) => setCalendarDate(date ?? undefined)}
                modifiers={{ hasEvent: calendarEventDates }}
                modifiersClassNames={{
                  hasEvent:
                    "relative after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
                }}
                className="rounded-md border"
              />
            </div>

            <h4 className="font-medium mb-3 text-sm md:text-base flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-sm">
                <Calendar className="h-4 w-4 text-white" />
              </div>
              Upcoming Events
              <BellRing className="h-4 w-4 text-amber-500 ml-1" />
            </h4>

            <div className="space-y-2">
              {sortedCalendarEvents.length === 0 ? (
                <div className="text-xs md:text-sm text-muted-foreground border border-dashed rounded-lg p-3">
                  No events yet. Pick a date on the calendar and add your first milestone.
                </div>
              ) : (
                sortedCalendarEvents.map((event) => {
                  const eventDate = parseCalendarDate(event.date);
                  return (
                    <div key={event.id} className="flex items-start gap-2 md:gap-3 p-2 md:p-3 bg-muted rounded-lg">
                      <div className="text-center min-w-[40px] md:min-w-[50px]">
                        <div className="text-[10px] md:text-xs text-muted-foreground">{eventDate.toLocaleDateString("en-US", { month: "short" })}</div>
                        <div className="text-base md:text-lg font-bold">{eventDate.getDate()}</div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs md:text-sm truncate">{event.title}</p>
                        {event.time && <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">🕒 {event.time}</p>}
                        {event.notes && <p className="text-[10px] md:text-xs text-muted-foreground mt-1 line-clamp-2">{event.notes}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={weddingEventTypeVariant(event.type)} className="text-[10px] md:text-xs capitalize">
                            {formatWeddingEventTypeLabel(event.type)}
                          </Badge>
                          {event.reminder && <BellRing className="w-3 h-3 text-muted-foreground" />}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="p-1 md:p-2"
                          title="Add to Google Calendar"
                          onClick={() => {
                            const url = buildGoogleCalendarUrl({
                              title: event.title,
                              date: parseCalendarDate(event.date),
                              time: event.time,
                              notes: event.notes,
                            });
                            window.open(url, "_blank", "noopener,noreferrer");
                          }}
                        >
                          <Calendar className="w-3 h-3 text-blue-600" />
                        </Button>

                        <Button size="sm" variant="ghost" className="p-1 md:p-2" onClick={() => handleRemoveCalendarEvent(event.id)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3 text-sm md:text-base flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-sm">
                <CalendarIcon className="h-4 w-4 text-white" />
              </div>
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
                <Clock className="h-4 w-4 text-white" />
              </div>
              Add Event
            </h4>

            <div className="space-y-2 md:space-y-3">
              <Input
                type="date"
                className="text-sm"
                value={calendarDate ? normalizeCalendarDate(calendarDate) : ""}
                onChange={(e) => setCalendarDate(e.target.value ? parseCalendarDate(e.target.value) : undefined)}
              />

              <Input type="time" className="text-sm" value={calendarEventTime} onChange={(e) => setCalendarEventTime(e.target.value)} />

              <Input placeholder="Event title" className="text-sm" value={calendarTitle} onChange={(e) => setCalendarTitle(e.target.value)} />

              <Select value={calendarType} onValueChange={setCalendarType}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Event type" />
                </SelectTrigger>
                <SelectContent>
                  {WEDDING_EVENT_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Textarea placeholder="Notes (optional)" className="h-16 md:h-20 text-sm" value={calendarNotes} onChange={(e) => setCalendarNotes(e.target.value)} />

              <div className="flex items-center gap-2">
                <input type="checkbox" id="reminder" className="rounded" checked={calendarReminder} onChange={(e) => setCalendarReminder(e.target.checked)} />
                <label htmlFor="reminder" className="text-xs md:text-sm">
                  Set reminder
                </label>
              </div>

              <Button className="w-full text-sm" onClick={handleAddCalendarEvent}>
                <Plus className="w-4 h-4 mr-2" />
                Add to Calendar
              </Button>
            </div>
          </div>
        </div>

        <Alert className="mt-6">
          <TrendingUp className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            <strong>Pro tip:</strong> Most couples book venues 10-12 months before their wedding date.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
