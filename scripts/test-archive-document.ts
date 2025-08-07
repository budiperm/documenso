import { prisma } from '@documenso/prisma';

async function testArchiveDocument() {
  try {
    // Find a completed document to test with
    const completedDocument = await prisma.document.findFirst({
      where: {
        status: 'COMPLETED',
        contentArchived: false,
      },
    });

    if (!completedDocument) {
      console.log('No completed document found to test archival');
      return;
    }

    console.log(`Found document: ${completedDocument.title} (ID: ${completedDocument.id})`);
    console.log(`Status: ${completedDocument.status}, Archived: ${completedDocument.contentArchived}`);

    // Archive the document for testing
    const updatedDocument = await prisma.document.update({
      where: { id: completedDocument.id },
      data: {
        contentArchived: true,
        archivedAt: new Date(),
      },
    });

    console.log(`✅ Document archived successfully!`);
    console.log(`Updated status: Archived: ${updatedDocument.contentArchived}, ArchivedAt: ${updatedDocument.archivedAt}`);
    
  } catch (error) {
    console.error('Error testing document archival:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testArchiveDocument();
