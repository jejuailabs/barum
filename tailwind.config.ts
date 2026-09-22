import type {Config} from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {extend: {
    colors: {
      base: 'var(--bg-base)', surface: {1:'var(--surface-1)',2:'var(--surface-2)',3:'var(--surface-3)',glass:'var(--surface-glass)'},
      ink: {DEFAULT:'var(--text-primary)',secondary:'var(--text-secondary)',tertiary:'var(--text-tertiary)',inverse:'var(--text-inverse)'},
      accent: {DEFAULT:'var(--accent)',hover:'var(--accent-hover)',soft:'var(--accent-soft)'},
      success:'var(--success)', warning:'var(--warning)', danger:'var(--danger)', info:'var(--info)', drive:'var(--drive)', sunset:'var(--sunset)'
    },
    borderRadius: {pill:'var(--r-pill)',xl:'var(--r-xl)',lg:'var(--r-lg)',md:'var(--r-md)',sm:'var(--r-sm)',xs:'var(--r-xs)'},
    boxShadow: {card:'var(--shadow-card)',sheet:'var(--shadow-sheet)',fab:'var(--shadow-fab)'},
    fontFamily: {sans:['var(--font-body)']},
    fontSize: {
      'display-xl':['64px',{lineHeight:'1',fontWeight:'700',letterSpacing:'-0.03em'}],
      'display-l':['40px',{lineHeight:'1.05',fontWeight:'700'}],
      'title-xl':['34px',{lineHeight:'1.2',fontWeight:'700'}],
      'title-l':['28px',{lineHeight:'1.25',fontWeight:'700'}],
      'title-m':['22px',{lineHeight:'1.3',fontWeight:'700'}],
      'title-s':['18px',{lineHeight:'1.35',fontWeight:'600'}],
      'value-l':['26px',{lineHeight:'1.2',fontWeight:'700'}],
      'value-m':['20px',{lineHeight:'1.25',fontWeight:'700'}],
      'body-m':['15px',{lineHeight:'1.5',fontWeight:'400'}],
      'body-s':['13px',{lineHeight:'1.45',fontWeight:'400'}],
      'label-m':['14px',{lineHeight:'1.3',fontWeight:'500'}],
      'label-s':['12px',{lineHeight:'1.3',fontWeight:'500'}],
      'mono-s':['12px',{lineHeight:'1.3',fontWeight:'500'}]
    }
  }},
  plugins:[]
} satisfies Config;

