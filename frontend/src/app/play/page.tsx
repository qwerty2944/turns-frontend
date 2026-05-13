import { Suspense } from "react";
import { GameTable } from "@/widgets/game-table/ui/GameTable";

export default function PlayPage() {
  return (
    <Suspense>
      <GameTable />
    </Suspense>
  );
}
