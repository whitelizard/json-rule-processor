import React, { useState, useEffect, useRef } from 'react';
import { load } from './index2';

export const makeJsonLispProcess = options => {
  const useJsonLispProcess = processConf => {
    const run = useRef();

    useEffect(() => {
      run.current = load(processConf, options);
    }, []);
  };
  return useJsonLispProcess;
};
