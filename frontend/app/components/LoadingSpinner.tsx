interface LoadingSpinnerProps {
     size?: "sm" | "md" | "lg";
     className?: string;
}

const sizeClasses = {
     sm: "h-4 w-4",
     md: "h-6 w-6",
     lg: "h-12 w-12",
};

export default function LoadingSpinner({
     size = "md",
     className = "",
}: LoadingSpinnerProps) {
     return (
          <div
               className={`inline-block animate-spin rounded-full border-b-2 border-current ${sizeClasses[size]} ${className}`}>
               <span className="sr-only">Loading...</span>
          </div>
     );
}
