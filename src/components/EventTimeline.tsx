import { Event } from '../types/monitoring';
import { Clock } from 'lucide-react';

interface EventTimelineProps {
  events: Event[];
}

export default function EventTimeline({ events }: EventTimelineProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5" />
        Event Timeline
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Time (s)</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Event</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={2} className="text-center py-8 text-gray-400">
                  No events recorded yet
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">{event.timestamp}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">{event.message}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {events.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 text-right">
          Total events: {events.length}
        </div>
      )}
    </div>
  );
}
