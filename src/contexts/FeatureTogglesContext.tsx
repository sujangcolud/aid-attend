import React, { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FeatureToggles {
  [key: string]: boolean;
}

interface FeatureTogglesContextType {
  featureToggles: FeatureToggles;
  isLoading: boolean;
}

const FeatureTogglesContext = createContext<FeatureTogglesContextType | undefined>(undefined);

export const FeatureTogglesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data = [], isLoading } = useQuery({
    queryKey: ['feature-toggles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('feature_toggles').select('*');
      if (error) throw error;
      return data;
    },
  });

  const featureToggles = data.reduce((acc: FeatureToggles, toggle) => {
    acc[toggle.feature_name] = toggle.is_enabled;
    return acc;
  }, {});

  return (
    <FeatureTogglesContext.Provider value={{ featureToggles, isLoading }}>
      {children}
    </FeatureTogglesContext.Provider>
  );
};

export const useFeatureToggles = () => {
  const context = useContext(FeatureTogglesContext);
  if (context === undefined) {
    throw new Error('useFeatureToggles must be used within a FeatureTogglesProvider');
  }
  return context;
};
