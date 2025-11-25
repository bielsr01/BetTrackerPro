import { BetCard } from '../bet-card';

export default function BetCardExample() {
  const mockBetData = {
    id: "1",
    eventDate: "2024-09-29T15:48:00",
    sport: "Futebol",
    league: "Liga Pro Jupiler",
    teamA: "OH Leuven",
    teamB: "Anderlecht",
    profitPercentage: 2.22,
    status: "pending" as const,
    bet1: {
      id: "b1",
      house: "Pinnacle",
      accountHolder: "João Silva",
      betType: "Acima 2.25",
      odd: 2.25,
      stake: 2650.00,
      potentialProfit: 106.00,
    },
    bet2: {
      id: "b2",
      house: "Betano",
      accountHolder: "Maria Santos",
      betType: "Abaixo 2.25",
      odd: 2.25,
      stake: 2120.00,
      potentialProfit: 106.00,
    },
  };

  const handleResolve = (betId: string, result: "won" | "lost" | "returned") => {
    console.log(`Resolved ${betId} as ${result}`);
  };

  return (
    <div className="max-w-4xl p-4">
      <BetCard {...mockBetData} onResolve={handleResolve} />
    </div>
  );
}