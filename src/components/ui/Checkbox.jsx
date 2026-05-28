import React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "../../utils/cn";

const Checkbox = React.forwardRef(({
    className,
    id,
    checked,
    indeterminate = false,
    disabled = false,
    required = false,
    label,
    description,
    error,
    size = "default",
    variant = "default",
    onChange,
    ...props
}, ref) => {
    const isEventAction = variant === "eventAction";
    const isEventStatus = variant === "eventStatus";
    const isEventVariant = isEventAction || isEventStatus;
    const showEventFill = isEventAction || checked || indeterminate;
    const showEventIcon = isEventAction || checked || indeterminate;

    // Generate unique ID if not provided
    const checkboxId = id || `checkbox-${Math.random()?.toString(36)?.substr(2, 9)}`;

    // Size variants
    const sizeClasses = {
        sm: "h-4 w-4",
        default: "h-4 w-4",
        lg: "h-6 w-6",
        action: "h-14 w-14",
        actionSm: "h-7 w-7"
    };

    // Extract size from className if provided (e.g., w-12 h-12)
    const extractedSize = className?.match(/[wh]-(\d+)/)?.[1];
    const checkboxSize = extractedSize ? `h-${extractedSize} w-${extractedSize}` : sizeClasses?.[size];
    const iconSize =
        size === "action" ? 24 :
        size === "actionSm" ? 12 :
        size === 'lg' ? 16 :
        (extractedSize ? parseInt(extractedSize) * 3 : 12); // Scale icon proportionally

    const handleChange = (e) => {
        if (onChange) {
            onChange(e);
        }
    };

    return (
        <div className={cn("flex items-start space-x-2", className)}>
            <div className="relative flex items-center">
                <input
                    type="checkbox"
                    ref={ref}
                    id={checkboxId}
                    checked={checked}
                    disabled={disabled}
                    required={required}
                    className="sr-only"
                    onChange={handleChange}
                    {...props}
                />

                <label
                    htmlFor={checkboxId}
                    className={cn(
                        isEventVariant
                            ? "group peer relative shrink-0 overflow-hidden rounded-full border-0 text-white cursor-pointer transition-all duration-200 ease-out flex items-center justify-center shadow-[0_10px_24px_rgba(22,163,74,0.28)] hover:scale-105"
                            : "peer shrink-0 rounded-none border-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground cursor-pointer transition-colors flex items-center justify-center",
                        checkboxSize,
                        isEventVariant && showEventFill
                            ? "shadow-[0_12px_28px_rgba(21,128,61,0.38)]"
                            : "",
                        variant === "default" && checked && "bg-primary text-primary-foreground border-primary",
                        variant === "default" && indeterminate && "bg-primary text-primary-foreground border-primary",
                        variant === "default" && error && "border-destructive",
                        disabled && isEventVariant && "cursor-default opacity-100 hover:scale-100 pointer-events-none",
                        disabled && variant === "default" && "cursor-not-allowed opacity-50 hover:scale-100"
                    )}
                >
                    {isEventVariant ? (
                        <>
                            <span
                                className={cn(
                                    "absolute inset-0 rounded-full transition-all duration-200",
                                    showEventFill
                                        ? "bg-gradient-to-br from-emerald-400 via-emerald-500 to-green-700"
                                        : "bg-white"
                                )}
                            />
                            <span
                                className={cn(
                                    "absolute rounded-full",
                                    size === "actionSm" ? "inset-[2px]" : "inset-[4px]",
                                    showEventFill ? "border border-white/20" : "border border-emerald-300"
                                )}
                            />
                            <span className="absolute inset-0 rounded-full bg-white/0 transition-colors duration-200 group-hover:bg-white/10" />
                            <span
                                className={cn(
                                    "relative z-10 transition-opacity duration-200",
                                    showEventFill ? "opacity-100 mix-blend-screen" : "opacity-0"
                                )}
                            >
                                {indeterminate ? (
                                    <Minus className={cn("text-white")} style={{ width: iconSize, height: iconSize }} />
                                ) : (
                                    <Check className={cn("text-white")} style={{ width: iconSize, height: iconSize }} />
                                )}
                            </span>
                            <svg
                                viewBox="0 0 110 110"
                                className="pointer-events-none absolute -inset-[4px] h-[calc(100%+8px)] w-[calc(100%+8px)] text-emerald-950"
                                aria-hidden="true"
                            >
                                <circle
                                    cx="55"
                                    cy="55"
                                    r="48"
                                    className={cn(
                                        "fill-none stroke-current [stroke-width:4px] [stroke-dasharray:302] transition-[stroke-dashoffset,opacity] duration-700 ease-in-out",
                                        showEventFill ? "[stroke-dashoffset:302] opacity-100 group-hover:[stroke-dashoffset:96]" : "[stroke-dashoffset:302] opacity-0",
                                        !isEventAction && (checked || indeterminate) && "[stroke-dashoffset:138] opacity-100"
                                    )}
                                />
                            </svg>
                        </>
                    ) : (
                        <>
                            {checked && !indeterminate && (
                                <Check className={cn("text-current")} style={{ width: iconSize, height: iconSize }} />
                            )}
                            {indeterminate && (
                                <Minus className={cn("text-current")} style={{ width: iconSize, height: iconSize }} />
                            )}
                        </>
                    )}
                </label>
            </div>
            {(label || description || error) && (
                <div className="flex-1 space-y-1">
                    {label && (
                        <label
                            htmlFor={checkboxId}
                            className={cn(
                                "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer",
                                error ? "text-destructive" : "text-foreground"
                            )}
                        >
                            {label}
                            {required && <span className="text-destructive ml-1">*</span>}
                        </label>
                    )}

                    {description && !error && (
                        <p className="text-sm text-muted-foreground">
                            {description}
                        </p>
                    )}

                    {error && (
                        <p className="text-sm text-destructive">
                            {error}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
});

Checkbox.displayName = "Checkbox";

// Checkbox Group component
const CheckboxGroup = React.forwardRef(({
    className,
    children,
    label,
    description,
    error,
    required = false,
    disabled = false,
    ...props
}, ref) => {
    return (
        <fieldset
            ref={ref}
            disabled={disabled}
            className={cn("space-y-3", className)}
            {...props}
        >
            {label && (
                <legend className={cn(
                    "text-sm font-medium",
                    error ? "text-destructive" : "text-foreground"
                )}>
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                </legend>
            )}

            {description && !error && (
                <p className="text-sm text-muted-foreground">
                    {description}
                </p>
            )}

            <div className="space-y-2">
                {children}
            </div>

            {error && (
                <p className="text-sm text-destructive">
                    {error}
                </p>
            )}
        </fieldset>
    );
});

CheckboxGroup.displayName = "CheckboxGroup";

export { Checkbox, CheckboxGroup };
