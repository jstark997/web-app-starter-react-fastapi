type BadgeVariant = 'admin' | 'user' | 'active' | 'inactive' | 'verified' | 'unverified';

interface BadgeProps {
  variant: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  admin: 'bg-purple-100 text-purple-800',
  user: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-red-100 text-red-800',
  verified: 'bg-green-100 text-green-800',
  unverified: 'bg-yellow-100 text-yellow-800',
};

const labelMap: Record<BadgeVariant, string> = {
  admin: 'Admin',
  user: 'User',
  active: 'Active',
  inactive: 'Inactive',
  verified: 'Verified',
  unverified: 'Unverified',
};

export function Badge({ variant, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {labelMap[variant]}
    </span>
  );
}

export type { BadgeProps, BadgeVariant };
