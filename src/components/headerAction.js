import { createContext, useContext, useEffect, useRef } from 'react';

// TabLayout provides the setter through this context; a page calls
// useHeaderAction(...) to place a single action button in the global top bar
// (right cluster, next to the refresh button) for as long as it's mounted.
export const HeaderActionContext = createContext(() => {});

// Register a top-bar action button. Pass a descriptor
//   { label, ariaLabel, onClick }
// to show it, or null/false to show nothing. The button is cleared
// automatically when the component unmounts or the descriptor turns falsy.
// onClick is read from a ref so the latest handler is always used without
// re-registering on every render.
export function useHeaderAction(descriptor) {
  const setHeaderAction = useContext(HeaderActionContext);
  const ref = useRef(descriptor);
  ref.current = descriptor;

  const active = !!descriptor;
  const label = descriptor ? descriptor.label : null;
  const ariaLabel = descriptor ? descriptor.ariaLabel : null;

  useEffect(() => {
    if (!active) {
      setHeaderAction(null);
      return undefined;
    }
    setHeaderAction({
      label,
      ariaLabel,
      onClick: () => {
        const d = ref.current;
        if (d && typeof d.onClick === 'function') d.onClick();
      },
    });
    return () => setHeaderAction(null);
  }, [setHeaderAction, active, label, ariaLabel]);
}
