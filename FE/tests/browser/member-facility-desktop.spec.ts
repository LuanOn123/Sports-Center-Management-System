import { test, expect } from '@playwright/test';
import { setup } from './fixtures';
for (const width of [1024, 1440, 1920]) test(`member selects facility on desktop ${width}`, async ({ page }) => {
 await setup(page, 'MEMBER');
 await page.setViewportSize({width,height:900});
 await page.goto('/member/classes');
 const picker=page.getByRole('combobox',{name:'Cơ sở tìm lớp',exact:true});
 await expect(picker).toBeVisible();
 await page.screenshot({path:`artifacts/facility-desktop-${width}.png`});
 const calls:string[]=[];
 page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('/classes')) calls.push(r.headers()['x-facility-id']);});
 await picker.selectOption('facility-b');
 await expect(picker).toHaveValue('facility-b');
 await expect.poll(()=>calls.includes('facility-b')).toBe(true);
 await expect(page.getByRole('heading',{name:/Khám phá/}).first()).toBeVisible();
});
