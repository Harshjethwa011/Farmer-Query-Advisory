import { LoaderCircle } from 'lucide-react';
export function PageHeading({eyebrow,title,description,action}){return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action&&<div className="heading-action">{action}</div>}</div>}
export function Alert({children,type='error'}){return <div className={`alert alert-${type}`} role={type==='error'?'alert':'status'}>{children}</div>}
export function Button({children,loading=false,className='',...props}){return <button className={`button ${className}`} disabled={loading||props.disabled} {...props}>{loading&&<LoaderCircle size={16} className="spin"/>}{children}</button>}
export function Loading(){return <div className="loading-line"><LoaderCircle size={18} className="spin"/> Loading…</div>}
