describe('Gallery Grid - 3 Column Enforcement', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should always display exactly 3 columns at all viewport widths', () => {
    const viewports = [
      { width: 320, height: 568 },   // iPhone SE
      { width: 375, height: 667 },   // iPhone 6/7/8
      { width: 768, height: 1024 },  // iPad portrait
      { width: 1024, height: 768 },  // iPad landscape
      { width: 1280, height: 800 },  // Desktop
      { width: 1920, height: 1080 }  // Large desktop
    ];

    viewports.forEach(({ width, height }) => {
      cy.viewport(width, height);
      
      cy.get('.flowing-grid').should('exist').then($grid => {
        const gridStyles = getComputedStyle($grid[0]);
        const columns = gridStyles.gridTemplateColumns.split(' ').length;
        
        expect(columns).to.equal(3, `Expected exactly 3 columns at ${width}px viewport, got ${columns}`);
      });

      // Verify first 9 tiles are visible in 3x3 grid (if 9+ projects exist)
      cy.get('.gallery-tile').then($tiles => {
        if ($tiles.length >= 9) {
          // Check that first 9 tiles are visible above the fold
          for (let i = 0; i < 9; i++) {
            cy.get('.gallery-tile').eq(i).should('be.visible');
          }
        }
      });
    });
  });

  it('should enforce strict 3-column grid without gaps', () => {
    const assertThreeCols = () => {
      cy.get('.strict-three-column-grid').then($grid => {
        const gridStyles = getComputedStyle($grid[0]);
        const columns = gridStyles.gridTemplateColumns.split(' ').length;
        expect(columns).to.eq(3);
      });
    };

    [375, 768, 1280, 1920].forEach(width => {
      cy.viewport(width, 900);
      assertThreeCols();
    });
  });

  it('should not have hover flicker issues', () => {
    // Test hover stability - cursor should remain pointer throughout hover
    cy.get('.gallery-tile').first().within(() => {
      cy.get('a').trigger('mouseover');
      
      // Wait a moment for any potential flicker
      cy.wait(100);
      
      // Verify cursor remains pointer and hover state is stable
      cy.get('a').should('have.css', 'cursor', 'pointer');
      
      // Check that preview panel appears without interfering with cursor
      cy.get('[class*="scaleY"]').should('exist');
      
      cy.get('a').trigger('mouseout');
    });
  });

  it('should center grid on ultrawide screens', () => {
    cy.viewport(2560, 1440); // Ultrawide
    
    cy.get('.strict-three-column-grid').then($grid => {
      const gridRect = $grid[0].getBoundingClientRect();
      const windowWidth = Cypress.config('viewportWidth');
      
      // Grid should be centered with max-width constraint
      expect($grid).to.have.css('max-width', '1200px');
      expect($grid).to.have.css('margin-left', 'auto');
      expect($grid).to.have.css('margin-right', 'auto');
    });
  });

  it('should have square aspect ratio tiles', () => {
    cy.get('.gallery-tile').first().within(() => {
      cy.get('[class*="aspect-square"]').should('exist').then($tile => {
        const rect = $tile[0].getBoundingClientRect();
        const aspectRatio = rect.width / rect.height;
        
        // Should be approximately 1:1 (square)
        expect(aspectRatio).to.be.closeTo(1, 0.1);
      });
    });
  });
});