describe('Hover Stability and Preview Behavior', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should not have cursor flickering on hover', () => {
    cy.get('.gallery-tile').first().within(() => {
      // Initial state should have pointer cursor
      cy.get('a').should('have.css', 'cursor', 'pointer');
      
      // Hover and verify cursor remains stable
      cy.get('a').trigger('mouseover');
      
      // Wait for any potential transitions
      cy.wait(300);
      
      // Cursor should still be pointer
      cy.get('a').should('have.css', 'cursor', 'pointer');
      
      // Preview should be visible
      cy.get('[class*="scaleY"]').should('exist');
      
      // Move mouse within the tile - cursor should remain stable
      cy.get('a').trigger('mousemove');
      cy.wait(50);
      cy.get('a').should('have.css', 'cursor', 'pointer');
      
      // Leave hover
      cy.get('a').trigger('mouseout');
      
      // Preview should disappear
      cy.get('[class*="scaleY"]').should('not.exist');
    });
  });

  it('should render preview inside tile to prevent flicker', () => {
    cy.get('.gallery-tile').first().within(() => {
      cy.get('a').trigger('mouseover');
      
      // Preview should be inside the tile container
      cy.get('[class*="scaleY"]').should('exist');
      cy.get('[class*="scaleY"]').should('have.class', 'absolute');
      cy.get('[class*="scaleY"]').should('have.css', 'pointer-events', 'none');
      
      // Verify it's positioned at bottom of tile
      cy.get('[class*="scaleY"]').should('have.class', 'bottom-0');
      cy.get('[class*="scaleY"]').should('have.class', 'inset-x-0');
    });
  });

  it('should handle mobile preview modal correctly', () => {
    cy.viewport(375, 667); // Mobile viewport
    
    cy.get('.gallery-tile').first().within(() => {
      // Should show modal on mobile, not inline preview
      cy.get('a').click();
    });
    
    // Modal should appear
    cy.get('[class*="fixed"][class*="inset-0"]').should('exist');
    cy.get('[class*="fixed"][class*="inset-0"]').should('be.visible');
    
    // Close modal
    cy.get('button').contains('Close').click();
    cy.get('[class*="fixed"][class*="inset-0"]').should('not.exist');
  });

  it('should handle keyboard navigation without flicker', () => {
    cy.get('.gallery-tile').first().within(() => {
      // Focus with tab
      cy.get('[tabindex="0"]').focus();
      
      // Press Enter to show preview
      cy.get('[tabindex="0"]').type('{enter}');
      
      // Preview should appear
      cy.get('[class*="scaleY"]').should('exist');
      
      // Press Escape to hide preview
      cy.get('[tabindex="0"]').type('{esc}');
      
      // Preview should disappear
      cy.get('[class*="scaleY"]').should('not.exist');
    });
  });

  it('should handle video autoplay correctly', () => {
    // Assuming first project has a cover video
    cy.get('.gallery-tile').first().within(() => {
      cy.get('video').then($video => {
        if ($video.length > 0) {
          // Video should be paused initially
          expect($video[0].paused).to.be.true;
          
          // Hover should start video
          cy.get('a').trigger('mouseover');
          cy.wait(100);
          
          // Video should be playing
          expect($video[0].paused).to.be.false;
          
          // Leave hover should pause video
          cy.get('a').trigger('mouseout');
          cy.wait(100);
          
          // Video should be paused and reset
          expect($video[0].paused).to.be.true;
          expect($video[0].currentTime).to.equal(0);
        }
      });
    });
  });
});