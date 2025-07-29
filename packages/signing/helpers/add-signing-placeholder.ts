import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFString,
  rectangle,
} from 'pdf-lib';

import { BYTE_RANGE_PLACEHOLDER } from '../constants/byte-range';

export type AddSigningPlaceholderOptions = {
  pdf: Buffer;
  signers?: string[];
  documentId?: number;
};

export const addSigningPlaceholder = async ({ pdf, signers = [], documentId }: AddSigningPlaceholderOptions) => {
  const doc = await PDFDocument.load(pdf);
  const [firstPage] = doc.getPages();

  const byteRange = PDFArray.withContext(doc.context);

  byteRange.push(PDFNumber.of(0));
  byteRange.push(PDFName.of(BYTE_RANGE_PLACEHOLDER));
  byteRange.push(PDFName.of(BYTE_RANGE_PLACEHOLDER));
  byteRange.push(PDFName.of(BYTE_RANGE_PLACEHOLDER));

  // Create reason text with all signers
  let reasonText = 'Signed by Documenso';
  
  if (signers && signers.length > 0) {
    // If signers array has one item and it contains line breaks, it's already formatted with timestamps
    if (signers.length === 1 && (signers[0].indexOf('\n') !== -1 || signers[0].indexOf('\r\n') !== -1)) {
      // Use fallback pipe format instead of line breaks since they don't work in PDF signature reason
      const lines = signers[0].split(/\r?\n/);
      reasonText = `Signed by: ${lines.join(' || ')}`;
    } else if (signers.length === 1 && signers[0].indexOf('.') !== -1) {
      // If it's a single formatted string (like "1. John Doe - 07/29/2025")
      reasonText = `Signed by: ${signers[0]}`;
    } else {
      // Otherwise, join the signers with clearer separation using pipes
      reasonText = `Signed by: ${signers.join(' || ')}`;
    }
  }

  const signature = doc.context.register(
    doc.context.obj({
      Type: 'Sig',
      Filter: 'Adobe.PPKLite',
      SubFilter: 'adbe.pkcs7.detached',
      ByteRange: byteRange,
      Contents: PDFHexString.fromText(' '.repeat(4096)),
      Reason: PDFString.of(reasonText),
      M: PDFString.fromDate(new Date()),
    }),
  );

  const widget = doc.context.register(
    doc.context.obj({
      Type: 'Annot',
      Subtype: 'Widget',
      FT: 'Sig',
      Rect: [0, 0, 0, 0],
      V: signature,
      T: PDFString.of('Signature1'),
      F: 4,
      P: firstPage.ref,
      AP: doc.context.obj({
        N: doc.context.register(doc.context.formXObject([rectangle(0, 0, 0, 0)])),
      }),
    }),
  );

  let widgets: PDFArray;

  try {
    widgets = firstPage.node.lookup(PDFName.of('Annots'), PDFArray);
  } catch {
    widgets = PDFArray.withContext(doc.context);

    firstPage.node.set(PDFName.of('Annots'), widgets);
  }

  widgets.push(widget);

  let arcoForm: PDFDict;

  try {
    arcoForm = doc.catalog.lookup(PDFName.of('AcroForm'), PDFDict);
  } catch {
    arcoForm = doc.context.obj({
      Fields: PDFArray.withContext(doc.context),
    });

    doc.catalog.set(PDFName.of('AcroForm'), arcoForm);
  }

  let fields: PDFArray;

  try {
    fields = arcoForm.lookup(PDFName.of('Fields'), PDFArray);
  } catch {
    fields = PDFArray.withContext(doc.context);

    arcoForm.set(PDFName.of('Fields'), fields);
  }

  fields.push(widget);

  arcoForm.set(PDFName.of('SigFlags'), PDFNumber.of(3));

  return Buffer.from(await doc.save({ useObjectStreams: false }));
};
