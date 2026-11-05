// Change the fingerprint when the reviewed cover letter changes so old acknowledgments expire.
export const coverLetterFingerprint='51a129f1380bd820';
export const coverLetterVersion=(year:string)=>`${year}:${coverLetterFingerprint}`;
