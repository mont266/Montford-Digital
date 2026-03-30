CREATE TABLE IF NOT EXISTS portfolio_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_src TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    detailed_description TEXT,
    tags TEXT[] DEFAULT '{}',
    link_webapp TEXT,
    link_android TEXT,
    link_ios TEXT,
    is_placeholder BOOLEAN DEFAULT false,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable RLS
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to portfolio items"
    ON portfolio_items FOR SELECT
    USING (true);

CREATE POLICY "Allow authenticated users to insert portfolio items"
    ON portfolio_items FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update portfolio items"
    ON portfolio_items FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete portfolio items"
    ON portfolio_items FOR DELETE
    USING (auth.role() = 'authenticated');

-- Insert initial data
INSERT INTO portfolio_items (image_src, title, category, description, detailed_description, tags, link_webapp, link_android, link_ios, is_placeholder, order_index)
VALUES
('public/images/stoutly-portfolio.png', 'Stoutly', 'iOS, Android & Web Apps', 'A comprehensive platform with both a web app and native Android app.', 'Stoutly is a personal passion project built from the ground up. It is a dedicated social network for Guinness enthusiasts, allowing users to rate pints of Guinness around the world. The platform fosters community engagement by letting users comment on ratings and share their experiences. A key feature is the location-based discovery engine, enabling users to instantly find the best and cheapest pints of Guinness nearby, no matter where they are in the world.', ARRAY['Social Network', 'Location Based', 'Community'], 'https://app.stoutly.co.uk', 'https://play.google.com/store/apps/details?id=uk.co.stoutly.twa', 'https://apps.apple.com/in/app/stoutly/id6758011319', false, 0),
('https://picsum.photos/seed/future-project-1/600/400', 'Coming Soon', 'Future Project', 'We''re working on something amazing. Stay tuned!', '', ARRAY[]::TEXT[], NULL, NULL, NULL, true, 1),
('https://picsum.photos/seed/future-project-2/600/400', 'Coming Soon', 'Future Project', 'We''re working on something amazing. Stay tuned!', '', ARRAY[]::TEXT[], NULL, NULL, NULL, true, 2),
('https://picsum.photos/seed/future-project-3/600/400', 'Coming Soon', 'Future Project', 'We''re working on something amazing. Stay tuned!', '', ARRAY[]::TEXT[], NULL, NULL, NULL, true, 3),
('https://picsum.photos/seed/future-project-4/600/400', 'Coming Soon', 'Future Project', 'We''re working on something amazing. Stay tuned!', '', ARRAY[]::TEXT[], NULL, NULL, NULL, true, 4),
('https://picsum.photos/seed/future-project-5/600/400', 'Coming Soon', 'Future Project', 'We''re working on something amazing. Stay tuned!', '', ARRAY[]::TEXT[], NULL, NULL, NULL, true, 5);
