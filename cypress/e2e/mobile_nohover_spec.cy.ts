describe('Mobile No-Hover Behavior', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should not reveal preview on mouseover at mobile viewport', () => {
    cy.viewport(375, 667); // iPhone viewport
    
    // Get first gallery tile
    cy.get('.gallery-tile').first().within(() => {
      // Preview should be hidden initially
      cy.get('.tile-preview').should('not.be.visible');
      
      // Trigger mouseover (which might happen on touch devices)
      cy.get('a').trigger('mouseover');
      
      // Preview should remain hidden on touch devices
      cy.get('.tile-preview').should('not.be.visible');
    });
  });

  it('should navigate on tap instead of showing preview', () => {
    cy.viewport(375, 667);
    
    // Intercept navigation to prevent actual page change in test
    cy.window().then((win) => {
      cy.stub(win.history, 'pushState').as('navigate');
    });
    
    cy.get('.gallery-tile').first().within(() => {
      // Click should trigger navigation, not preview
      cy.get('a').click();
    });
    
    // Should have attempted navigation
    cy.get('@navigate').should('have.been.called');
  });

  it('should handle mobile video teasers correctly', () => {
    cy.viewport(375, 667);
    
    // Find a tile with video (if any)
    cy.get('.cover-video').first().then($video => {
      if ($video.length > 0) {
        const video = $video[0] as HTMLVideoElement;
        
        // Video should be paused initially
        expect(video.paused).to.be.true;
        
        // Scroll video into view to trigger intersection observer
        cy.get($video).scrollIntoView();
        
        // Wait for intersection observer to trigger
        cy.wait(500);
        
        // Video should start playing
        cy.get($video).then($v => {
          const v = $v[0] as HTMLVideoElement;
          expect(v.paused).to.be.false;
        });
        
        // After 2 seconds, video should pause
        cy.wait(2100);
        cy.get($video).then($v => {
          const v = $v[0] as HTMLVideoElement;
          expect(v.paused).to.be.true;
        });
      }
    });
  });

  it('should not show hover effects on touch devices', () => {
    cy.viewport(375, 667);
    
    cy.get('.gallery-tile').first().within(() => {
      // Simulate touch start/end
      cy.get('a').trigger('touchstart');
      cy.get('a').trigger('touchend');
      
      // Preview should not appear
      cy.get('.tile-preview').should('not.be.visible');
      
      // Video overlay should not appear
      cy.get('.video-overlay').should('have.css', 'opacity', '0');
    });
  });
});