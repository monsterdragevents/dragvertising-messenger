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
        gradient: "bg-gradient-to-r from-dv-purple-600 via-dv-pink-500 to-dv-orange-400 hover:from-dv-purple-700 hover:via-dv-pink-600 hover:to-dv-orange-500 dark:from-dv-purple-500 dark:via-dv-pink-400 dark:to-dv-orange-300 dark:hover:from-dv-purple-600 dark:hover:via-dv-pink-500 dark:hover:to-dv-orange-400 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]",
        gradientSecondary: "bg-gradient-to-r from-dv-purple-600 to-dv-blue-600 hover:from-dv-purple-700 hover:to-dv-blue-700 dark:from-dv-purple-500 dark:to-dv-blue-500 dark:hover:from-dv-purple-600 dark:hover:via-dv-pink-500 dark:hover:to-dv-blue-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02]",
        success: "bg-dv-green-600 hover:bg-dv-green-700 dark:bg-dv-green-500 dark:hover:bg-dv-green-600 text-white shadow-md hover:shadow-lg",
        purple: "bg-dv-purple-600 hover:bg-dv-purple-700 dark:bg-dv-purple-500 dark:hover:bg-dv-purple-600 text-white shadow-md hover:shadow-lg",
        // Dragvertising-inspired variants
        dragvertising: "bg-gradient-to-r from-dv-golden-500 via-dv-pink-500 to-dv-purple-600 hover:from-dv-golden-600 hover:via-dv-pink-600 hover:to-dv-purple-700 dark:from-dv-golden-400 dark:via-dv-pink-500 dark:to-dv-purple-500 dark:hover:from-dv-golden-500 dark:hover:via-dv-pink-600 dark:hover:to-dv-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]",
        golden: "bg-dv-golden-500 hover:bg-dv-golden-600 dark:bg-dv-golden-400 dark:hover:bg-dv-golden-500 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]",
        goldenGradient: "bg-gradient-to-r from-dv-golden-500 to-dv-warmOrange-500 hover:from-dv-golden-600 hover:to-dv-warmOrange-600 dark:from-dv-golden-400 dark:to-dv-warmOrange-400 dark:hover:from-dv-golden-500 dark:hover:to-dv-warmOrange-500 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]",
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
