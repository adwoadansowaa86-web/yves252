const paths = {
  cart: 'M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35',
  close: 'M18 6 6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  trash: 'M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14',
  check: 'M20 6 9 17l-5-5',
  truck: 'M3 6h11v10H3zM14 9h4l3 3v4h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  store: 'M4 9h16l-1-5H5zM5 9v11h14V9M9 20v-6h6v6',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z',
  chat: 'M21 12a8 8 0 0 1-11.8 7L3 21l2-5.8A8 8 0 1 1 21 12Z',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z',
  back: 'M15 18 9 12l6-6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  upload: 'M12 16V4m0 0-4 4m4-4 4 4M4 16v4h16v-4',
  download: 'M12 4v12m0 0-4-4m4 4 4-4M4 20h16',
  box: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.9a7 7 0 0 0-2-1.2L14.5 3h-5l-.4 2.5a7 7 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-.9a7 7 0 0 0 2 1.2l.4 2.5h5l.4-2.5a7 7 0 0 0 2-1.2l2.4.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  menu: 'M4 6h16M4 12h16M4 18h16',
};

export default function Icon({ name, size = 20, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={paths[name]} />
    </svg>
  );
}
