import React from 'react';
import { FaJava } from 'react-icons/fa';
import { TbBrandCSharp } from 'react-icons/tb';
import { SiC, SiCplusplus, SiJavascript, SiPython, SiGo } from 'react-icons/si';

const languageIcons = {
  java: FaJava,
  python: SiPython,
  c: SiC,
  cpp: SiCplusplus,
  javascript: SiJavascript,
  csharp: TbBrandCSharp,
  go: SiGo,
};

const LanguageLogo = ({ language, size = 'md', className = '', style }) => {
  const Icon = languageIcons[language];
  // WHY return null instead of a placeholder: an unmapped language is a data bug
  // the caller should be able to see, and react-icons has no generic "code"
  // glyph that would not be mistaken for a real language badge.
  if (!Icon) return null;

  return (
    <span className={`language-logo language-logo-${size} ${className}`} style={style} aria-label={`${language} logo`}>
      <Icon aria-hidden="true" />
    </span>
  );
};

export default LanguageLogo;
