import { useEffect, useRef } from 'react';

export function useBarcodeScanner(onScan: (barcode: string) => void) {
  const buffer = useRef('');
  const lastKeyTime = useRef(Date.now());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input, textarea, or contenteditable
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || (document.activeElement as HTMLElement)?.isContentEditable) {
        // We might want to allow scanning even if focused on an input if it's a specific "search" input, 
        // but typically barcode scanners fire very fast, we can also check the time difference.
        // For safety, if user is typing, we might ignore, BUT barcode scanners often type into inputs.
        // Let's refine: if it's a fast sequence ending in Enter, it's a barcode.
      }

      const currentTime = Date.now();
      
      if (currentTime - lastKeyTime.current > 50) {
        // Too slow, probably human typing
        buffer.current = '';
      }

      if (e.key === 'Enter') {
        if (buffer.current.length >= 3) {
          onScan(buffer.current);
          buffer.current = '';
          e.preventDefault(); // Prevent form submission if any
        }
      } else if (e.key.length === 1) { // Printable characters
        buffer.current += e.key;
      }

      lastKeyTime.current = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onScan]);
}
