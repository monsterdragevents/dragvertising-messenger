import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 min-w-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Standardized gradient variants
        gradient: "bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 hover:from-purple-700 hover:via-pink-600 hover:to-orange-500 dark:from-purple-500 dark:via-pink-400 dark:to-orange-300 dark:hover:from-purple-600 dark:hover:via-pink-500 dark:hover:to-orange-400 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]",
        gradientSecondary: "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 dark:from-purple-500 dark:to-blue-500 dark:hover:from-purple-600 dark:hover:to-blue-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02]",
        success: "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white shadow-md hover:shadow-lg",
        purple: "bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white shadow-md hover:shadow-lg",
        // Dragvertising-inspired variants
        dragvertising: "bg-gradient-to-r from-[#FFA726] via-[#FD0290] to-purple-600 hover:from-[#FF9800] hover:via-[#E60180] hover:to-purple-700 dark:from-[#FFB74D] dark:via-[#FD0290] dark:to-purple-500 dark:hover:from-[#FFA726] dark:hover:via-[#E60180] dark:hover:to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]",
        golden: "bg-[#FFA726] hover:bg-[#FF9800] dark:bg-[#FFB74D] dark:hover:bg-[#FFA726] text-white shadow-lg hover:shadow-xl hover:scale-[1.02]",
        goldenGradient: "bg-gradient-to-r from-[#FFA726] to-[#FF6B35] hover:from-[#FF9800] hover:to-[#F4511E] dark:from-[#FFB74D] dark:to-[#FF8A65] dark:hover:from-[#FFA726] dark:hover:to-[#FF6B35] text-white shadow-lg hover:shadow-xl hover:scale-[1.02]",
      },
      size: {
        default: "h-9 sm:h-10 px-4 sm:px-5 py-2 text-sm sm:text-sm",
        sm: "h-8 sm:h-9 rounded-lg px-3 sm:px-4 text-xs sm:text-sm",
        lg: "h-10 sm:h-11 rounded-xl px-7 sm:px-9 text-sm sm:text-base",
        icon: "h-9 w-9 sm:h-10 sm:w-10",
        xl: "h-11 sm:h-12 rounded-xl px-9 sm:px-12 py-4 sm:py-6 text-base sm:text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
