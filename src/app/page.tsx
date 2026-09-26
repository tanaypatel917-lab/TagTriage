import { Suspense } from "react";
import { CaptureView } from "@/components/capture/CaptureView";

export default function CapturePage() {
  return (
    <Suspense fallback={<h1 className="page-title">Capture</h1>}>
      <CaptureView />
    </Suspense>
  );
}
