'use strict';
// PDF creation stays on the applicant's device. Settings are read from the live admin configuration.
window.FCGCPdf={async create(data,config,{blank=false,labels={}}={}){
 data=FCGCAnswers.normalize(data);
 const {PDFDocument,StandardFonts,PDFName,rgb}=PDFLib;
 const [template,patchResponse]=await Promise.all([fetch('application.pdf?v=20261102-2'),fetch('pdf-settings.json?v=20261104-review')]);
 if(!template.ok||!patchResponse.ok)throw new Error('The application template could not load. Your answers are still here.');
 const doc=await PDFDocument.load(await template.arrayBuffer()),form=doc.getForm();
 const font=await doc.embedFont(StandardFonts.TimesRoman),bold=await doc.embedFont(StandardFonts.TimesRomanBold);
 const fields=new Map(form.getFields().map(f=>[f.getName(),f])),overflow=[];
 const clean=s=>String(s??'').replace(/\r\n?/g,'\n').replace(/\t/g,' ');
 function wrap(text,width,size=9){const result=[];for(const para of clean(text).split('\n')){if(!para){result.push('');continue;}let line='';for(const word of para.split(/\s+/)){if(font.widthOfTextAtSize((line?line+' ':'')+word,size)<=width){line+=(line?' ':'')+word;continue;}if(line){result.push(line);line='';}let rest=word;while(font.widthOfTextAtSize(rest,size)>width){let n=1;while(n<rest.length&&font.widthOfTextAtSize(rest.slice(0,n+1),size)<=width)n++;result.push(rest.slice(0,n));rest=rest.slice(n);}line=rest;}result.push(line);}return result;}
 function encode(text,label){try{font.encodeText(clean(text).replaceAll('\n',' '));}catch{throw new Error(`The answer for ${label} has a symbol this PDF cannot print. Replace emoji or unusual symbols and try again.`);}}
 for(const patch of await patchResponse.json()){
  const page=doc.getPage(patch.page),value=patch.kind==='footer'?`March ${config.year}`:patch.kind==='year'?config.year+(patch.suffix||''):patch.kind==='academicYear'?`${config.year}-${Number(config.year)+1}`:patch.kind==='awardsYear'?`SCHOLARSHIP OR GRANT AWARDED FOR ${config.year}-${Number(config.year)+1}`:patch.kind==='photo'?`A digital photo of the applicant should be emailed to: ${config.photoEmail}`:patch.kind==='destination'?'Complete and submit this application on the Foundation website.':`Deadline: ${config.deadline}`;
  const face=patch.bold?bold:font;encode(value,patch.kind);let size=patch.size;
  while(size>6.5&&face.widthOfTextAtSize(value,size)>patch.width)size-=.1;
  page.drawRectangle({x:patch.x,y:patch.y,width:patch.width,height:patch.height,color:rgb(1,1,1)});
  page.drawText(value,{x:patch.x+.5,y:patch.baseline??patch.y+2,size,font:face,color:patch.kind==='photo'?rgb(.75,0,0):rgb(0,0,0)});
 }
 for(const f of fields.values())if(f instanceof PDFLib.PDFTextField){
  f.removeMaxLength();f.setFontSize(9);
  for(const w of f.acroField.getWidgets()){const mk=w.getAppearanceCharacteristics();if(mk){mk.dict.delete(PDFName.of('BG'));mk.dict.delete(PDFName.of('BC'));}w.getOrCreateBorderStyle().setWidth(0);}
 }
 // Draw the same square selection marks in every generated PDF.
 const selections=[];
 for(const [name,f] of fields){
  if(f instanceof PDFLib.PDFCheckBox||f instanceof PDFLib.PDFRadioGroup){
   const radio=f instanceof PDFLib.PDFRadioGroup,options=radio?f.getOptions():[];
   f.acroField.getWidgets().forEach((w,i)=>selections.push({page:name.startsWith('relationship_')?0:2,rect:w.getRectangle(),on:radio?data[name]===options[i]:data[name]===true,radio}));
   form.removeField(f);fields.delete(name);
  }
 }

 function setText(name,value){const f=fields.get(name);if(!(f instanceof PDFLib.PDFTextField))return;let text=clean(value);encode(text,labels[name]||name.replaceAll('_',' '));const rect=f.acroField.getWidgets()[0].getRectangle();let size=9;
  if(f.isMultiline()){if(wrap(text,rect.width-5).length>Math.floor(rect.height/10)){overflow.push(`${labels[name]||name.replaceAll('_',' ')}: ${text}`);text='See Additional Information.';}}
  else if(font.widthOfTextAtSize(text,size)>rect.width-5){overflow.push(`${labels[name]||name.replaceAll('_',' ')}: ${text}`);text=rect.width<65?'*':'See addl. info.';}
  f.setFontSize(size);f.setText(text);
 }
 const paired=new Set([...fields.keys()].filter(n=>n.endsWith('_continued')).map(n=>n.slice(0,-10)));
 for(const [name,value] of Object.entries(data)){
  if(name==='additional_information'||name==='signatures'||paired.has(name)||name.startsWith('annual_')||/^aid_\d_amount$/.test(name)||name.endsWith('_typed_name'))continue;
  const f=fields.get(name);if(!f)continue;
  if(f instanceof PDFLib.PDFCheckBox){if(value)f.check();}
  else if(f instanceof PDFLib.PDFRadioGroup){if(value==='Yes'||value==='No')f.select(value);}
  else setText(name,value);
 }
 for(const name of paired){const text=clean(data[name]);encode(text,labels[name]||name);const first=fields.get(name),second=fields.get(name+'_continued');const lines=wrap(text,first.acroField.getWidgets()[0].getRectangle().width-5);let a=lines.shift()||'',b=lines.join(' ');if(wrap(b,second.acroField.getWidgets()[0].getRectangle().width-5).length>1){overflow.push(`${labels[name]||name.replaceAll('_',' ')}: ${text}`);a='See Additional Information.';b='';}first.setText(a);second.setText(b);}
 if(!blank){const totals=window.scholarship.totals(data);if(!totals)throw new Error('Check the highlighted dollar amounts.');for(const name of window.scholarship.moneyNames)setText(name,(window.scholarship.cents(data[name])/100).toFixed(2));for(const [name,value] of Object.entries(totals))setText(name,(value/100).toFixed(2));}
 const extra=[clean(data.additional_information),...overflow].filter(Boolean).join('\n\n');let lines=wrap(extra,430);
 for(let i=1;i<=27;i++)setText(`additional_information_line_${String(i).padStart(2,'0')}`,lines.shift()||'');
 while(lines.length){const page=doc.addPage([612,792]);page.drawText('Additional Information (continued)',{x:50,y:742,size:14,font:bold});for(let y=714;lines.length&&y>54;y-=15)page.drawText(lines.shift(),{x:50,y,size:9,font});}
 const signed=[],drawnSignatures=[];
 for(const [role,fieldName] of [['student','student_typed_name'],['parent','parent_guardian_typed_name']]){
  const signature=data.signatures?.[role];if(!signature)continue;
  const box=fields.get(fieldName).acroField.getWidgets()[0].getRectangle();encode(signature.name,`${role} signature`);
  if(signature.image){const image=await doc.embedPng(signature.image);const scale=Math.min(box.width/image.width,box.height/image.height);drawnSignatures.push({image,box:{x:box.x,y:box.y,width:image.width*scale,height:image.height*scale}});}
  else setText(fieldName,signature.name);
  signed.push(`${role==='student'?'Student':'Parent / guardian'}: ${signature.name} - electronically signed ${new Date(signature.at).toLocaleString('en-US',{timeZone:'America/New_York'})} ET`);
 }
 if(signed.length){const page=doc.getPage(3);page.drawText('Electronic signatures applied by the signers with their consent.',{x:89,y:256,size:8,font});signed.forEach((line,i)=>{let size=8;while(size>6&&font.widthOfTextAtSize(line,size)>435)size-=.25;page.drawText(line,{x:89,y:244-i*12,size,font});});}
 form.updateFieldAppearances(font);
 form.flatten();for(const page of doc.getPages())page.node.delete(PDFName.of('Annots'));doc.catalog.delete(PDFName.of('AcroForm'));
 for(const {page:pi,rect:r,on,radio} of selections){const page=doc.getPage(pi);
  page.drawRectangle({x:r.x-9,y:r.y-5,width:radio?60:r.width+15,height:r.height+9,color:rgb(1,1,1)});
  page.drawRectangle({x:r.x+1,y:r.y+1,width:8.5,height:8.5,borderWidth:.7,borderColor:rgb(0,0,0)});
  if(on){page.drawLine({start:{x:r.x+2.3,y:r.y+5},end:{x:r.x+4.4,y:r.y+2.6},thickness:1,color:rgb(0,0,0)});page.drawLine({start:{x:r.x+4.4,y:r.y+2.6},end:{x:r.x+8.3,y:r.y+8},thickness:1,color:rgb(0,0,0)});}
 }
 // Match both signature labels without moving the approved signature lines.
 for(const [label,y] of [['Student Signature',386.23],['Parent or Guardian Signature',307.49]]){
  const page=doc.getPage(3),size=8.52;
  page.drawRectangle({x:359,y:y-2,width:166,height:13,color:rgb(1,1,1)});
  page.drawText(label,{x:442-bold.widthOfTextAtSize(label,size)/2,y,size,font:bold,color:rgb(0,0,0)});
 }
 // Subtle emphasis only: retain all other existing wording and lines.
 for(const box of [{x:80,y:279,width:452,height:169},{x:80,y:114,width:452,height:111}])doc.getPage(3).drawRectangle({...box,color:rgb(.15,.5,.3),opacity:.07,borderColor:rgb(.64,.75,.67),borderWidth:.6});

 // Flattened empty-field appearances can be opaque. Paint signatures last.
 for(const {image,box} of drawnSignatures)doc.getPage(3).drawImage(image,box);
 // Prepend the reviewed original only after indexed application/signature work.
 // Personalize a copy of its salutation; the master letter and body remain unchanged.
 {
  const response=await fetch('cover-letter.pdf?v=20261104-letter-restored');
  if(!response.ok)throw new Error('The original cover letter could not load. Please try the download again.');
  const cover=await PDFDocument.load(await response.arrayBuffer());
  if(!blank){
   const name=clean(data.applicant_name).replaceAll('\n',' ').trim();
   if(!name)throw new Error('Enter your full name before downloading your personalized application packet.');
   const greeting=`Dear ${name},`,greetingLines=wrap(greeting,466,11.04);
   if(greetingLines.length>2)throw new Error('Your full name needs more room on the cover letter. Contact the Foundation for help with your packet.');
   const page=cover.getPage(0),coverFont=await cover.embedFont(StandardFonts.TimesRoman);
   page.drawRectangle({x:71.5,y:613,width:469,height:17,color:rgb(1,1,1)});
   greetingLines.forEach((line,i)=>page.drawText(line,{x:72.024,y:619-i*13,size:11.04,font:coverFont,color:rgb(0,0,0)}));
  }
  const pages=await doc.copyPages(cover,cover.getPageIndices());
  pages.forEach((page,index)=>doc.insertPage(index,page));
 }
 if(data.testApplication)for(const page of doc.getPages())page.drawText('TEST APPLICATION - FICTIONAL ANSWERS - DO NOT PROCESS',{x:52,y:12,size:8,font:bold,color:rgb(.65,.15,.1)});
 doc.catalog.delete(PDFName.of('StructTreeRoot'));doc.catalog.delete(PDFName.of('MarkInfo'));
 doc.setTitle(`${config.year} Fox Chapel Scholarship Application`);doc.setAuthor('Fox Chapel Golf Club Scholarship Foundation, Inc.');
 return doc.save();
}};
