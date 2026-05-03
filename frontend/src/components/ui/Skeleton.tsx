type SkeletonVariant = 'text' | 'circular' | 'rectangular';

interface SkeletonProps {
  width?: string;
  height?: string;
  variant?: SkeletonVariant;
  className?: string;
}

const variantClasses: Record<SkeletonVariant, string> = {
  text: 'rounded',
  circular: 'rounded-full',
  rectangular: 'rounded-md',
};

export function Skeleton({
  width,
  height,
  variant = 'rectangular',
  className = '',
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-gray-200 ${variantClasses[variant]} ${className}`}
      style={{
        width: width ?? '100%',
        height: height ?? (variant === 'text' ? '1em' : '100%'),
      }}
    />
  );
}

export type { SkeletonProps };
