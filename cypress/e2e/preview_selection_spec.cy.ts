/// <reference types="cypress" />

describe('Preview File Selection Validation', () => {
  beforeEach(() => {
    cy.visit('http://localhost:8083/');
  });

  it('Should display correct preview files based on directory contents', () => {
    // Wait for tiles to load
    cy.get('.gallery-tile', { timeout: 15000 }).should('have.length.greaterThan', 60);

    // Test specific folders with known preview files
    const testCases = [
      { folder: '01', expectedFile: '01_short.mp4', title: 'Dior Holiday by Elena Kechicheva' },
      { folder: '02', expectedFile: '02_preview.jpg', title: 'Givenchy Beauty by Pascal Ming Hao Lou' },
      { folder: '03', expectedFile: '03_short.mp4', title: 'Givenchy Beauty Le Rouge by Jonathan Elhaik' },
      { folder: '04', expectedFile: 'preview.png', title: 'Schön Magazine' },
      { folder: '06', expectedFile: 'preview.png', title: 'Dior Magazine by Aishwarya Aruum Bekha' },
      { folder: '07', expectedFile: 'preview.jpg', title: 'Dior Jewelry by Melanie + Ramon' },
      { folder: '13', expectedFile: 'preview.jpg', title: 'Zadig & Voltaire by Melissa de Araujo' },
      { folder: '16', expectedFile: 'preview.png', title: 'Dior Fall by Tess Ayano' },
    ];

    testCases.forEach(({ folder, expectedFile, title }) => {
      cy.log(`Testing folder ${folder}: expecting ${expectedFile}`);
      
      // Find the tile for this folder by checking the media src
      cy.get('.gallery-tile').each(($tile) => {
        cy.wrap($tile).find('video, img').then(($media) => {
          const src = $media.attr('src');
          
          // Check if this is the tile for our folder
          if (src && src.includes(`/media/hidrive/${folder}/`)) {
            // Verify it's using the correct preview file
            expect(src).to.include(expectedFile, 
              `Folder ${folder} should use ${expectedFile} but got ${src}`);
            
            // Verify the title is correct
            cy.wrap($tile).find('h3').invoke('text').then((text) => {
              expect(text.trim()).to.equal(title,
                `Folder ${folder} should have title "${title}" but got "${text.trim()}"`);
            });
          }
        });
      });
    });
  });

  it('Should prioritize preview.* files over other files', () => {
    // Folders that have preview.* files should use them
    const foldersWithPreview = ['04', '06', '07', '13', '16', '21', '22', '27', '28', '29', '31', '33', '34', '35', '36', '37', '38'];
    
    foldersWithPreview.forEach((folder) => {
      cy.get('.gallery-tile').each(($tile) => {
        cy.wrap($tile).find('video, img').then(($media) => {
          const src = $media.attr('src');
          
          if (src && src.includes(`/media/hidrive/${folder}/`)) {
            // Should contain 'preview.' in the filename
            expect(src).to.match(/preview\.(png|jpg|mp4)/i,
              `Folder ${folder} should use a preview.* file but got ${src}`);
          }
        });
      });
    });
  });

  it('Should use _short files when no preview.* exists', () => {
    // Folders that have _short files
    const foldersWithShort = ['01', '03', '17', '32'];
    
    foldersWithShort.forEach((folder) => {
      cy.get('.gallery-tile').each(($tile) => {
        cy.wrap($tile).find('video, img').then(($media) => {
          const src = $media.attr('src');
          
          if (src && src.includes(`/media/hidrive/${folder}/`)) {
            // Should contain '_short' in the filename
            expect(src).to.include('_short',
              `Folder ${folder} should use a _short file but got ${src}`);
          }
        });
      });
    });
  });

  it('Should NOT use preview files as full-resolution files', () => {
    // When clicking on a tile, the lightbox should show the full file, not the preview
    cy.get('.gallery-tile').first().click();
    
    // Wait for lightbox to open (it's a fixed overlay with z-50)
    cy.get('.fixed.inset-0.z-50', { timeout: 5000 }).should('be.visible');
    
    // Check that the full image/video is NOT a preview file
    cy.get('.fixed.inset-0.z-50').find('video, img').then(($media) => {
      const src = $media.attr('src');
      
      // Should NOT contain 'preview' or '_short' in the filename
      expect(src).to.not.match(/preview\./i, 'Lightbox should not show preview.* files');
      expect(src).to.not.include('_short', 'Lightbox should not show _short files');
      expect(src).to.not.include('_preview', 'Lightbox should not show _preview files');
    });
  });

  it('Should load manifest with correct preview URLs', () => {
    // Fetch the manifest and verify it has correct structure
    cy.request('/media.manifest.json').then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('items');
      expect(response.body.items).to.be.an('array');
      expect(response.body.items.length).to.be.greaterThan(60);
      
      // Check a few specific items
      const item04 = response.body.items.find((item: any) => item.folder === '04');
      expect(item04).to.exist;
      expect(item04.previewUrl).to.include('preview.png');
      expect(item04.title).to.equal('Schön Magazine');
      
      const item06 = response.body.items.find((item: any) => item.folder === '06');
      expect(item06).to.exist;
      expect(item06.previewUrl).to.include('preview.png');
      expect(item06.title).to.equal('Dior Magazine by Aishwarya Aruum Bekha');
    });
  });
});
