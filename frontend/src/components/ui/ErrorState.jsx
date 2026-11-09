import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./Button";

export function ErrorState({ message = "Something went wrong.", onRetry }) {
  return (
    <div className="flex min-h-[35vh] flex-col items-center justify-center gap-4 rounded-2xl border border-[#e3e0ea] bg-[#FFFFFF] p-10 text-center shadow-lg">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#A92C34]/30 bg-[#A92C34]/10 text-[#A92C34]">
        <AlertTriangle size={22} />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-[#191626]">Unable to Complete Request</h4>
        <p className="max-w-sm text-xs leading-relaxed text-[#5e596c]">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} icon={RefreshCw} className="mt-2 text-xs">
          Retry Request
        </Button>
      )}
    </div>
  );
}
