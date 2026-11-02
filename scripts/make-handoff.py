from pathlib import Path
import os,zipfile,base64,json,sys
p=Path(__file__).resolve().parent.parent
archive=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else p/'outputs/Fox-Chapel-Scholarship-Website.zip'
archive.parent.mkdir(parents=True,exist_ok=True)
exclude={'node_modules','.git','.wrangler','.vinext','.sites-runtime','dist','outputs','.next'}
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,strict_timestamps=False) as z:
 for name in ['index.html','guide.html']:z.write(p/'portable-template'/name,'Portable website/'+name)
 for directory,dirs,files in os.walk(p/'public'):
  for name in files:
   f=Path(directory)/name
   if f.suffix=='.zip' or name in {'mobile-check.html','cover-letter.pdf'}:continue
   destination='Portable website/'+f.relative_to(p/'public').as_posix()
   if f==p/'public/apply/app.js':
    z.writestr(destination,f.read_text(encoding='utf8').replace("fetch('/api/application'","fetch('./settings.json'"))
   elif f==p/'public/apply/index.html':
    z.writestr(destination,f.read_text(encoding='utf8').replace('href="/"','href="../index.html"').replace('href="/manage"','href="../guide.html"'))
   else:z.write(f,destination)
 content=json.loads((p/'lib/default-content.json').read_text(encoding='utf8'))
 settings={**content,'submissionEmail':content['submissionRecipients'][0],'canSubmit':False,'submissionToken':None}
 z.writestr('Portable website/apply/settings.json',json.dumps(settings))
 z.write(p/'lib/default-content.json','Portable website/content.json')
 for name in ['START-HERE-JANET.md','HANDOFF.md']:z.write(p/'docs'/name,name)
 for directory,dirs,files in os.walk(p):
  dirs[:]=[d for d in dirs if d not in exclude]
  for name in files:
   f=Path(directory)/name;rel=f.relative_to(p)
   if name.startswith('.env') or name.startswith('.dev.vars') or name=='package-data.ts' or f==archive:continue
   z.write(f,'Source/'+rel.as_posix())
 z.writestr('Source/lib/package-data.ts',"// Run python scripts/make-handoff.py before building to include a fresh source package.\nexport const packageBase64='';\n")
(p/'lib/package-data.ts').write_text('export const packageBase64='+json.dumps(base64.b64encode(archive.read_bytes()).decode())+';\n',encoding='utf8')
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert 'Source/scripts/make-handoff.py' in z.namelist()
 assert 'Source/lib/package-data.ts' in z.namelist()
print(json.dumps({'archive':str(archive),'bytes':archive.stat().st_size,'files':len(z.namelist()),'integrity':'passed'}))
