import { Star } from "lucide-react";

interface StarRatingDisplayProps {
  averageRating: number;
  ratingCount: number;
  size?: "sm" | "md";
}

export function StarRatingDisplay({
  averageRating,
  ratingCount,
  size = "sm",
}: StarRatingDisplayProps) {
  if (ratingCount === 0) {
    return (
      <span className="text-xs text-muted-foreground">No ratings</span>
    );
  }

  const iconSize = size === "sm" ? "size-3.5" : "size-4";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <span className={`flex items-center gap-1 ${textSize}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`${iconSize} ${
            i < Math.round(averageRating)
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/40"
          }`}
        />
      ))}
      <span className="text-muted-foreground">
        {averageRating.toFixed(1)} ({ratingCount})
      </span>
    </span>
  );
}
