import React, { type ReactNode, type ReactElement } from 'react'
import copy from 'copy-to-clipboard'

export interface CopyToClipboardProps { 
  text: string;
  children: ReactNode;
  onCopy?: (text: string, result: boolean) => void;
  options?: {
    debug?: boolean;
    message?: string;
    format?: string;
  };
}

export function CopyToClipboard({
  text,
  onCopy,
  children,
  options
}: CopyToClipboardProps) {
  const elem = React.Children.only(children) as ReactElement;

  const onClick = (event: React.MouseEvent) => {
    const result = copy(text, options);

    if (onCopy) {
      onCopy(text, result);
    }

    // Bypass onClick if it was present
    if (elem && elem.props && typeof elem.props.onClick === 'function') {
      elem.props.onClick(event);
    }
  };

  return React.cloneElement(elem, { onClick });
}

export default CopyToClipboard
