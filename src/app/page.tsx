import { FamiliarRail } from "@/components/familiar-rail";
import { ChatPane } from "@/components/chat-pane";
import { InspectorPane } from "@/components/inspector-pane";

export default function Home() {
  return (
    <div className="grid h-screen w-screen grid-cols-[240px_minmax(0,1fr)_360px] bg-zinc-950 text-zinc-100">
      <FamiliarRail />
      <ChatPane />
      <InspectorPane />
    </div>
  );
}
