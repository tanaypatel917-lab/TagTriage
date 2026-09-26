import type { Metadata } from "next";
import { BoardView } from "@/components/board/BoardView";

export const metadata: Metadata = { title: "Board" };

export default function BoardPage() {
  return <BoardView />;
}
