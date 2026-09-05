// src/hooks/useRouteTheme.js
// comentarios en minusculas y sin acentos
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from './useTheme';

/**
 * aplica el tema segun la ruta:
 * - login: 'system'
 * - resto: 'user'
 * si tu useTheme tiene otra firma, ajusta la linea que llama useTheme(...)
 */
export default function useRouteTheme() {
  const { pathname } = useLocation();

  // aplica el tema cada vez que cambia la ruta
  useTheme(pathname === '/login' ? 'system' : 'user');

  // dependencia explicita para que eslint no reclame
  useEffect(() => {}, [pathname]);
}