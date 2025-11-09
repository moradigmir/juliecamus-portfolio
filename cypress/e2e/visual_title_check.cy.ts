/// <reference types="cypress" />

describe('Visual Title Display Check', () => {
  it('Should display actual titles on hover, not "---"', () => {
    cy.visit('http://localhost:8083/');
    
    // Wait for tiles to load
    cy.get('.gallery-tile', { timeout: 15000 }).should('have.length.greaterThan', 60);
    
    // Check first 5 tiles
    cy.get('.gallery-tile').each(($tile, index) => {
      if (index >= 5) return false;
      
      // Hover over the tile
      cy.wrap($tile).trigger('mouseenter').wait(600);
      
      // Get the title text
      cy.wrap($tile).find('h3').invoke('text').then((text) => {
        const trimmed = text.trim();
        
        cy.log(`Tile ${index + 1} title: "${trimmed}"`);
        
        // Should NOT be "---"
        expect(trimmed).to.not.equal('---', `Tile ${index + 1} should not show "---"`);
        expect(trimmed).to.not.equal('', `Tile ${index + 1} should not be empty`);
        
        // Should be a real title (more than 3 characters)
        expect(trimmed.length).to.be.greaterThan(3, `Tile ${index + 1} should have a real title`);
      });
      
      cy.wrap($tile).trigger('mouseleave');
    });
  });
  
  it('Should show specific expected titles for known folders', () => {
    cy.visit('http://localhost:8083/');
    cy.get('.gallery-tile', { timeout: 15000 }).should('exist');
    
    // Expected titles for first few folders
    const expectedTitles = {
      '01': 'Dior Holiday by Elena Kechicheva',
      '02': 'Givenchy Beauty by Pascal Ming Hao Lou',
      '04': 'Schön Magazine',
      '06': 'Dior Magazine by Aishwarya Aruum Bekha'
    };
    
    Object.entries(expectedTitles).forEach(([folder, expectedTitle]) => {
      cy.get('.gallery-tile').each(($tile) => {
        cy.wrap($tile).find('video, img').then(($media) => {
          const src = $media.attr('src');
          
          if (src && src.includes(`/media/hidrive/${folder}/`)) {
            cy.log(`Found tile for folder ${folder}`);
            
            // Hover to reveal title
            cy.wrap($tile).trigger('mouseenter').wait(600);
            
            // Check title
            cy.wrap($tile).find('h3').invoke('text').then((text) => {
              const trimmed = text.trim();
              cy.log(`Folder ${folder} shows: "${trimmed}"`);
              expect(trimmed).to.equal(expectedTitle, 
                `Folder ${folder} should show "${expectedTitle}" but shows "${trimmed}"`);
            });
            
            cy.wrap($tile).trigger('mouseleave');
          }
        });
      });
    });
  });
});
