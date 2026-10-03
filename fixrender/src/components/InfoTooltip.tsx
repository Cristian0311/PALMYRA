import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface InfoTooltipProps {
  text: string;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function InfoTooltip({ 
  text, 
  className, 
  position = 'top' 
}: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positions = {
    top: '-top-2 left-1/2 -translate-x-1/2 -translate-y-full mb-2',
    bottom: '-bottom-2 left-1/2 -translate-x-1/2 translate-y-full mt-2',
    left: 'top-1/2 -left-2 -translate-x-full -translate-y-1/2 mr-2',
    right: 'top-1/2 -right-2 translate-x-full -translate-y-1/2 ml-2',
  };

  const arrows = {
    top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-t-slate-800 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'top-[-4px] left-1/2 -translate-x-1/2 border-b-slate-800 border-l-transparent border-r-transparent border-t-transparent',
    left: 'right-[-4px] top-1/2 -translate-y-1/2 border-l-slate-800 border-t-transparent border-b-transparent border-r-transparent',
    right: 'left-[-4px] top-1/2 -translate-y-1/2 border-r-slate-800 border-t-transparent border-b-transparent border-l-transparent',
  };

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <div 
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help text-slate-400 hover:text-indigo-500 transition-colors p-0.5"
      >
        <HelpCircle className="w-4 h-4" />
      </div>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className={cn(
              "absolute z-[9999] w-48 p-2 bg-slate-800 text-white text-[10px] leading-tight rounded-lg shadow-xl pointer-events-none text-center",
              positions[position]
            )}
          >
            {text}
            <div className={cn("absolute border-4", arrows[position])} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
