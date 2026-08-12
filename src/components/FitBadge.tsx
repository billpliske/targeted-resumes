import { FIT_RATING_LABELS, type FitRating } from '../types'

interface FitBadgeProps {
  rating: FitRating
}

function FitBadge({ rating }: FitBadgeProps) {
  return (
    <span className={`fit-badge fit-${rating}`}>
      {FIT_RATING_LABELS[rating]}
    </span>
  )
}

export default FitBadge
