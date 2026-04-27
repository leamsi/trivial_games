const { test, expect } = require('@playwright/test');

test.describe('Text Adventure Game', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/text-adventure/index.html');
    });

    test('should load and display initial message', async ({ page }) => {
        const terminal = page.locator('#terminal-history');
        await expect(terminal).toContainText('NEON TERMINAL ADVENTURE');
        await expect(terminal).toContainText('scroll');
    });

    test('should move between rooms', async ({ page }) => {
        // We use the testing interface to ensure deterministic movement
        // First room is always Dusty Library (or similar)
        const initialRoom = await page.evaluate(() => window.game.getCurrentRoom());

        // Find an exit
        const exit = await page.evaluate(() => Object.keys(window.game.instance.currentRoom.exits)[0]);

        await page.evaluate((dir) => window.game.executeCommand(`go ${dir}`), exit);

        const newRoom = await page.evaluate(() => window.game.getCurrentRoom());
        expect(newRoom).not.toBe(initialRoom);
    });

    test('should pick up items', async ({ page }) => {
        // Set seed to ensure 'scroll' or other items are reachable
        await page.evaluate(() => window.game.setTarget(123456));

        // Take an item (using the scroll as a proxy or finding an item)
        // Actually scroll is an object, not an item. Let's find a room with an item.
        const roomWithItem = await page.evaluate(() => {
            const r = window.game.instance.rooms.find(room => room.items.length > 0);
            window.game.instance.currentRoom = r;
            return r.items[0].name;
        });

        await page.evaluate((itemName) => window.game.executeCommand(`take ${itemName}`), roomWithItem);

        const inventory = await page.evaluate(() => window.game.getInventory());
        expect(inventory).toContain(roomWithItem);
    });

    test('should show contextual buttons', async ({ page }) => {
        const btnContainer = page.locator('#button-container');
        await expect(btnContainer.locator('button')).toContainText(['GO', 'LOOK', 'TAKE']);

        // Type 'go ' and check for direction buttons
        await page.fill('#user-input', 'go ');
        // We need to trigger the 'input' event manually or just click
        await page.locator('#user-input').dispatchEvent('input');

        // Check for direction buttons (e.g., NORTH, SOUTH, EAST, or WEST)
        const buttons = await btnContainer.locator('button').allTextContents();
        const directions = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
        expect(buttons.some(b => directions.includes(b))).toBeTruthy();
    });

    test('should win when opening exit door with master key', async ({ page }) => {
        await page.evaluate(() => {
            const keyRoom = window.game.instance.rooms.find(r => r.hasMasterKey);
            const exitRoom = window.game.instance.rooms.find(r => r.isEscapeDoor);

            // Cheat: give player key and teleport to exit
            window.game.instance.inventory.push({ name: "Master Key" });
            window.game.instance.currentRoom = exitRoom;
            window.game.instance.updateButtons();
        });

        await page.evaluate(() => window.game.executeCommand('open iron door'));

        const terminal = page.locator('#terminal-history');
        await expect(terminal).toContainText('YOU ESCAPED!');
    });

    test('should die from trap', async ({ page }) => {
        await page.evaluate(() => {
            const trapRoom = window.game.instance.rooms.find(r => r.objects.some(o => o.type === 'trap'));
            window.game.instance.currentRoom = trapRoom;
            window.game.instance.updateButtons();
        });

        await page.evaluate(() => window.game.executeCommand('open golden lever'));

        const terminal = page.locator('#terminal-history');
        await expect(terminal).toContainText('GAME OVER');
    });
});
