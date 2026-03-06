# Sample prompts for image generation/editing

These prompts are designed to generate a prompt for image generation or editing based on a user query. They are **not meant to be used directly as prompts** for image generation/editing, but to generate first a prompt that will then be passed to the image generation/editing command.

## software-logo

Create a prompt to generate a professional-looking logo icon suitable for a software project. 

```
Context and inspiration: <QUERY>.
Characteristics of the logo: Simple, vector, soft gradients, bright colors, flat, white background.
The logo MUST follow these characteristics EXACTLY. The should be usable at small icon dimensions like 64x64px.
Output under the logo/ folder.
```

## social-banner

Create a prompt to generate a professional social media banner suitable for OpenGraph, Twitter, and other social sharing platforms.

```
Context and inspiration: <QUERY>.
Do not use the context words directly as text in the banner, but rather as inspiration for the design unless the context explicitly includes text that should be part of the banner.
Target aspect ratio is 2:1 ratio - design for this ratio and make it fit the actual size of 1536x1024 pixels, using black bars.
Characteristics of the banner: Modern, professional, visually appealing for social media, bright colors, clean design, readable text elements if any, suitable for software project promotion.
The banner should work well as a social media preview image and represent the project effectively.
Output under the banner/ folder.
```
