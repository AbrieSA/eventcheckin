import React from 'react';
import Button from './Button';

const BackButton = ({
  children = 'Back',
  className = '',
  iconOnly = false,
  iconName = 'ArrowLeft',
  ...props
}) => {
  return (
    <Button
      variant="surface"
      size={iconOnly ? 'icon' : 'default'}
      iconName={iconName}
      className={`rounded-full ${iconOnly ? 'h-11 w-11 px-0' : 'h-11 px-4'} ${className}`.trim()}
      aria-label={iconOnly ? (typeof children === 'string' ? children : 'Go back') : props['aria-label']}
      {...props}
    >
      {iconOnly ? null : children}
    </Button>
  );
};

export default BackButton;
