describe('Desktop Hover Behavior', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should reveal preview on hover at desktop viewport', () => {
    cy.viewport(1280, 800); // Desktop viewport
    
    // Get first gallery tile
    cy.get('.gallery-tile').first().within(() => {
      // Preview should be hidden initially
      cy.get('.tile-preview').should('not.be.visible');
      
      // Hover over the tile
      cy.get('a').trigger('mouseover');
      
      // Preview should appear
      cy.get('.tile-preview').should('be.visible');
      
      // Move mouse away
      cy.get('a').trigger('mouseout');
      
      // Preview should hide again
      cy.get('.tile-preview').should('not.be.visible');
    });
  });

  it('should maintain cursor pointer throughout hover', () => {
    cy.viewport(1280, 800);
    
    cy.get('.gallery-tile').first().within(() => {
      cy.get('a').should('have.css', 'cursor', 'pointer');
      
      // Hover and check cursor remains pointer
      cy.get('a').trigger('mouseover');
      cy.get('a').should('have.css', 'cursor', 'pointer');
      
      // Check preview doesn't interfere with cursor
      cy.get('.tile-preview').should('have.css', 'pointer-events', 'none');
    });
  });

  it('should handle video autoplay on hover', () => {
    cy.viewport(1280, 800);
    
    // Find a tile with video (if any)
    cy.get('.cover-video').first().parent('.gallery-tile').within(() => {
      cy.get('video').then($video => {
        const video = $video[0] as HTMLVideoElement;
        expect(video.paused).to.be.true;
      });
      
      // Hover to trigger autoplay
      cy.get('a').trigger('mouseover');
      
      cy.get('video').then($video => {
        const video = $video[0] as HTMLVideoElement;
        // Video should start playing (may take a moment)
        cy.wait(100);
        expect(video.paused).to.be.false;
      });
      
      // Move mouse away
      cy.get('a').trigger('mouseout');
      
      cy.get('video').then($video => {
        const video = $video[0] as HTMLVideoElement;
        expect(video.paused).to.be.true;
        expect(video.currentTime).to.equal(0);
      });
    });
  });
});