import {useEffect, useState} from 'react';

export interface ResponsiveLayoutState {
  width: number;
  height: number;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
}

function readLayout(): ResponsiveLayoutState {
  if (typeof window === 'undefined') {
    return {
      width: 1280,
      height: 800,
      isPhone: false,
      isTablet: false,
      isDesktop: true,
      isLandscape: true,
    };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  return {
    width,
    height,
    isPhone: width < 640,
    isTablet: width >= 640 && width < 1024,
    isDesktop: width >= 1024,
    isLandscape: width > height,
  };
}

export function useResponsiveLayout(): ResponsiveLayoutState {
  const [layout, setLayout] = useState<ResponsiveLayoutState>(readLayout);

  useEffect(() => {
    const handleResize = () => setLayout(readLayout());
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return layout;
}
