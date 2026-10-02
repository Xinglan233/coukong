export type AdminSection='info'|'map'|'booth'|'session'|'team_code'
const sections:[AdminSection,string][]=[['info','活动信息'],['map','地图'],['booth','摊位'],['session','场次'],['team_code','建队码']]
export function FigmaAdminTabs({value,onChange,convention}:{value:AdminSection;onChange:(value:AdminSection)=>void;convention:boolean}){
 return <nav className="figma-admin-tabs" aria-label="活动编辑分区">{sections.map(([key,label])=><button key={key} aria-pressed={value===key} className={value===key?'on':''} disabled={!convention&&(key==='map'||key==='booth')} onClick={()=>onChange(key)}>{label}</button>)}</nav>
}
