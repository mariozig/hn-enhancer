class HNEnhancer {

    static AI_AVAILABLE = {
        YES: 'readily',
        NO: 'no',
        AFTER_DOWNLOAD: 'after-download'
    }

    constructor() {

        this.authorComments = new Map();    // Store comment elements by author
        this.popup = this.createAuthorPopup();
        this.postAuthor = this.getPostAuthor();
        this.activeHighlight = null;        // Track currently highlighted element
        this.highlightTimeout = null;       // Track highlight timeout
        this.currentComment = null;         // Track currently focused comment

        this.helpModal = this.createHelpModal();

        this.createHelpIcon();

        // Initialize the page based on type - home page vs. comments page
        if (this.isHomePage) {
            this.initHomePageNavigation();
        } else if (this.isCommentsPage) {
            // Initialize state for comments experience - author comments, comment navigation and summary panel,
            this.updateAuthorComments();
            this.initCommentsNavigation();
            this.summaryPanel = new SummaryPanel();
        }

        // TODO: move this to a more discrete place
        // Origin -> news.ycombinator.com; Registration for Summarization API
        const otMeta = document.createElement('meta');
        otMeta.httpEquiv = 'origin-trial';
        otMeta.content = 'Ah+d1HFcvvHgG3aB5OfzNzifUv02EpQfyQBlED1zXGCt8oA+XStg86q5zAwr7Y/UFDCmJEnPi019IoJIoeTPugsAAABgeyJvcmlnaW4iOiJodHRwczovL25ld3MueWNvbWJpbmF0b3IuY29tOjQ0MyIsImZlYXR1cmUiOiJBSVN1bW1hcml6YXRpb25BUEkiLCJleHBpcnkiOjE3NTMxNDI0MDB9';
        document.head.prepend(otMeta);

        this.initSummarizationAI();

    }

    get isHomePage() {
        const pathname = window.location.pathname;
        return pathname === '/' || pathname === '/news' || pathname === '/newest' || pathname === '/ask' || pathname === '/show' || pathname === '/front';
    }

    get isCommentsPage() {
        return window.location.pathname === '/item';
    }

    initCommentsNavigation() {
        this.setupKeyboardNavigation();  // Set up keyboard navigation
        this.addSummarizeCommentsLink(); // Add 'Summarize all comments' link to the main post
        this.setupUserHover();           // Set up hover events for author info

        // Navigate to first comment, but don't scroll to it (to avoid jarring effect when you first come to the page)
        this.navigateToFirstComment(false);
    }

    toggleHelpModal(show) {
        this.helpModal.style.display = show ? 'flex' : 'none';
    }

    createAuthorPopup() {
        const popup = document.createElement('div');
        popup.className = 'author-popup';
        document.body.appendChild(popup);
        return popup;
    }

    getPostAuthor() {
        const postAuthorElement = document.querySelector('.fatitem .hnuser');
        return postAuthorElement ? postAuthorElement.textContent : null;
    }

    async fetchUserInfo(username) {
        try {
            const response = await fetch(`https://hn.algolia.com/api/v1/users/${username}`, {cache: 'force-cache'});
            const userInfoResponse = await response.json();
            return {
                karma: userInfoResponse.karma || 'Not found', about: userInfoResponse.about || 'No about information'
            };
        } catch (error) {
            console.error('Error fetching user info:', error);
            return null;
        }
    }

    clearHighlight() {
        if (this.activeHighlight) {
            this.activeHighlight.classList.remove('highlight-author');
            this.activeHighlight = null;
        }
        if (this.highlightTimeout) {
            clearTimeout(this.highlightTimeout);
            this.highlightTimeout = null;
        }
    }

    highlightAuthor(authorElement) {
        this.clearHighlight();

        // Add highlight class to trigger animation
        authorElement.classList.add('highlight-author');
        this.activeHighlight = authorElement;
    }

    setupKeyboardNavigation() {

        // Save the last key press time and last key in order to handle double key press (eg: 'gg')
        let lastKey = '';
        let lastKeyPressTime = 0;

        // Add keyboard event listener
        document.addEventListener('keydown', (e) => {
            // Handle key press only when it is not in an input field
            const isInputField = e.target.matches('input, textarea, [contenteditable="true"]');
            if (isInputField) {
                return;
            }

            const result = this.handleKeyboardEvent(e, lastKey, lastKeyPressTime);
            if(result) {
                lastKey = result.lastKey;
                lastKeyPressTime = result.lastKeyPressTime;
            }
        });

        this.setupGlobalKeyboardShortcuts();
    }

    handleKeyboardEvent(e, lastKey, lastKeyPressTime) {

        switch (e.key) {

            case 'j': // Next comment at same depth (same as 'next' hyperlink)
                e.preventDefault();

                // Find the 'next' hyperlink in the HN nav panel and navigate to it.
                const nextComment = this.getNavElementByName(this.currentComment, 'next');
                if (nextComment) {
                    this.setCurrentComment(nextComment);
                }
                break;

            case 'k': // Previous comment at same depth (same as 'prev' hyperlink)
                e.preventDefault();

                // Find the 'prev' hyperlink in the HN nav panel and navigate to it.
                const prevComment = this.getNavElementByName(this.currentComment, 'prev');
                if (prevComment) {
                    this.setCurrentComment(prevComment);
                }
                break;

            case 'l': // Next child
                if (e.ctrlKey || e.metaKey) return; // Allow default behavior if Ctrl or Command key is pressed
                e.preventDefault();
                this.navigateToChildComment();
                break;

            case 'h': // Parent comment (same as 'parent' hyperlink)
                e.preventDefault();

                // Find the 'parent' hyperlink in the HN nav panel and navigate to it.
                const parentComment = this.getNavElementByName(this.currentComment, 'parent');
                if (parentComment) {
                    this.setCurrentComment(parentComment);
                }
                break;

            case 'r': // Root comment (same as 'root' hyperlink)
                e.preventDefault();

                // Find the 'root' hyperlink in the HN nav panel and navigate to it.
                const rootComment = this.getNavElementByName(this.currentComment, 'root');
                if (rootComment) {
                    this.setCurrentComment(rootComment);
                }
                break;

            case '[': {
                e.preventDefault();
                const authorElement = this.currentComment.querySelector('.hnuser');
                if (authorElement) {
                    const author = authorElement.textContent;
                    this.navigateAuthorComments(author, this.currentComment, 'prev');
                }
                break;
            }

            case ']': {
                e.preventDefault();
                const authorElement = this.currentComment.querySelector('.hnuser');
                if (authorElement) {
                    const author = authorElement.textContent;
                    this.navigateAuthorComments(author, this.currentComment, 'next');
                }
                break;
            }

            case 'z': // Scroll to current comment
                e.preventDefault();
                if (this.currentComment) {
                    this.currentComment.scrollIntoView({behavior: 'smooth', block: 'center'});
                }
                break;

            case 'c': // Collapse current comment
                e.preventDefault();
                if (this.currentComment) {
                    const toggleLink = this.currentComment.querySelector('.togg');
                    if (toggleLink) {
                        toggleLink.click();
                    }
                }
                break;

            case 'g': // Go to first comment (when pressed twice)
                e.preventDefault();

                const currentTime = Date.now();
                if (lastKey === 'g' && currentTime - lastKeyPressTime < 500) {
                    this.navigateToFirstComment();
                }

                // Update the last key and time so that we can handle the repeated press in the next iteration
                lastKey = 'g';
                lastKeyPressTime = currentTime;
                break;

            case 'o': // Open the original post in new window
                e.preventDefault();
                const postLink = document.querySelector('.titleline a');
                if (postLink) {
                    window.open(postLink.href, '_blank');
                }
                break;

            case 's': // Open the summary panel on the right
                if (!e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    this.summaryPanel.toggle();
                }
                break;
        }
        return {lastKey: lastKey, lastKeyPressTime: lastKeyPressTime};
    }

    navigateToFirstComment(scrollToComment = true) {
        const firstComment = document.querySelector('.athing.comtr');
        if (firstComment) {
            this.setCurrentComment(firstComment, scrollToComment);
        }
    }

    navigateToChildComment() {
        if (!this.currentComment) return;

        // The comments are arranged as a flat array of table rows where the hierarchy is represented by the depth of the element.
        //  So the next child is the next comment element in the array.
        let next = this.currentComment.nextElementSibling;

        while (next) {
            // Look for the element with the style classes of comment. If found, return. If not, continue to the next sibling.
            if (next.classList.contains('athing') && next.classList.contains('comtr')) {
                this.setCurrentComment(next);
                return; // Found the next child
            }
            next = next.nextElementSibling;
        }
    }

    getNavElementByName(comment, elementName) {
        if (!comment) return;

        // Get HN's default navigation panel and locate the nav element by the given name ('root', 'parent', 'next' or 'prev').
        const hyperLinks = comment.querySelectorAll('.comhead .navs a');
        if (hyperLinks) {
            // Find the <a href> with text that matches the given name
            const hyperLink = Array.from(hyperLinks).find(a => a.textContent.trim() === elementName);
            if (hyperLink) {
                const commentId = hyperLink.hash.split('#')[1];
                const element = document.getElementById(commentId);
                return element;
            }
        }
    }

    setCurrentComment(comment, scrollIntoView = true) {
        if (!comment) return;

        // Remove highlight from previous comment
        if (this.currentComment) {
            const prevIndicator = this.currentComment.querySelector('.current-comment-indicator');
            if (prevIndicator) {
                prevIndicator.remove();
            }
        }

        // Set and highlight new current comment
        this.currentComment = comment;

        // Highlight the author name
        const authorElement = comment.querySelector('.hnuser');
        if (authorElement) {
            this.highlightAuthor(authorElement);
        }

        if (scrollIntoView) {
            // Scroll into the comment view if needed
            comment.scrollIntoView({behavior: 'smooth', block: 'center'});
        }
    }

    convertMarkdownToHTML(markdown) {
        // Helper function to wrap all lists as unordered lists
        function wrapLists(html) {
            // Wrap any sequence of list items in ul tags
            return html.replace(/<li>(?:[^<]|<(?!\/li>))*<\/li>(?:\s*<li>(?:[^<]|<(?!\/li>))*<\/li>)*/g,
                match => `<ul>${match}</ul>`);
        }

        // First escape HTML special characters
        let html = markdown
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Convert markdown to HTML
        // noinspection RegExpRedundantEscape,HtmlUnknownTarget
        html = html
            // Headers
            .replace(/^##### (.*$)/gim, '<h5>$1</h5>')
            .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')

            // Blockquotes
            .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')

            // Code blocks and inline code
            .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')

            //  both bullet points and numbered lists to li elements
            .replace(/^\s*[\-\*]\s(.+)/gim, '<li>$1</li>')
            .replace(/^\s*(\d+)\.\s(.+)/gim, '<li>$2</li>')

            // Bold and Italic
            .replace(/\*\*(?=\S)([^\*]+?\S)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(?=\S)([^\*]+?\S)\*/g, '<em>$1</em>')
            .replace(/_(?=\S)([^\*]+?\S)_/g, '<em>$1</em>')

            // Images and links
            .replace(/!\[(.*?)\]\((.*?)\)/gim, "<img alt='$1' src='$2' />")
            .replace(/\[(.*?)\]\((.*?)\)/gim, "<a href='$2'>$1</a>")

            // Horizontal rules
            .replace(/^\s*[\*\-_]{3,}\s*$/gm, '<hr>')

            // Paragraphs and line breaks
            .replace(/\n\s*\n/g, '</p><p>')
            // .replace(/\n/g, '<br />');

        // Wrap all lists as unordered lists
        html = wrapLists(html);

        // Wrap everything in paragraphs if not already wrapped
        if (!html.startsWith('<')) {
            html = `<p>${html}</p>`;
        }

        return html.trim();
    }

    createHelpModal() {
        const modal = document.createElement('div');
        modal.className = 'keyboard-help-modal';
        modal.style.display = 'none';

        const content = document.createElement('div');
        content.className = 'keyboard-help-content';

        const title = document.createElement('h2');
        title.textContent = 'Keyboard Shortcuts';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'help-close-btn';
        closeBtn.textContent = '×';
        closeBtn.onclick = () => this.toggleHelpModal(false);

        const shortcutGroups = {
            "global": {
                title: 'Global',
                shortcuts: [
                    {key: 'o', description: 'Open post in new window'},
                    {key: '? /', description: 'Toggle this help panel'}
                ]
            },
            "home": {
                title: 'Home Pages (Home, New, Past, Ask, Show)',
                shortcuts: [
                    {key: 'j k', description: 'Next/previous post'},
                    {key: 'c', description: 'Open comments page'}
                ]
            },
            "comments": {
                title: 'Post Details Page',
                shortcuts: [
                    {key: 'j k', description: 'Next/previous comment'},
                    {key: 'l h', description: 'Next child/parent comment'},
                    {key: '[ ]', description: 'Prev/next comment by author'},
                    {key: 's', description: 'Toggle summary panel'},
                    {key: 'r', description: 'Go to root comment'},
                    {key: 'gg', description: 'First comment'},
                    {key: 'z', description: 'Scroll to current'},
                    {key: 'c', description: 'Collapse/expand comment'}
                ]
            }
        };

        const table = document.createElement('table');

        for (const groupKey in shortcutGroups) {
            const group = shortcutGroups[groupKey];  // Get the actual group object

            const headerRow = table.insertRow();
            const headerCell = headerRow.insertCell();
            headerCell.colSpan = 2;  // Span both columns
            headerRow.className = 'group-header';

            const subHeading = document.createElement('h3');
            subHeading.textContent = group.title;
            headerCell.appendChild(subHeading);

            group.shortcuts.forEach(shortcut => {
                const shortcutRow = table.insertRow();

                const keyCell = shortcutRow.insertCell();

                // Keys could be 'l', 'h' for single keys, 'gg' for repeated keys or '?|/' for multiple keys
                const keys = shortcut.key.split(' ');
                keys.forEach((k, index) => {
                    const keySpan = document.createElement('span');
                    keySpan.className = 'key';
                    keySpan.textContent = k;
                    keyCell.appendChild(keySpan);

                    if (index < keys.length - 1) {
                        const separator = document.createElement('span');
                        separator.textContent = ' or ';
                        keyCell.appendChild(separator);
                    }
                });

                const descCell = shortcutRow.insertCell();
                descCell.textContent = shortcut.description;
            });
        }

        content.appendChild(closeBtn);
        content.appendChild(title);
        content.appendChild(table);

        const footer = document.createElement('div');
        footer.className = 'keyboard-help-footer';
        footer.innerHTML = 'Learn more about features and updates on our <a href="https://github.com/levelup-apps/hn-enhancer/" target="_blank" rel="noopener">GitHub page</a> ↗️';
        content.appendChild(footer);

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.toggleHelpModal(false);
            }
        });

        return modal;
    }

    createHelpIcon() {
        const icon = document.createElement('div');
        icon.className = 'help-icon';
        icon.innerHTML = '?';
        icon.title = 'Keyboard Shortcuts (Press ? or / to toggle)';

        icon.onclick = () => this.toggleHelpModal(true);

        document.body.appendChild(icon);
        return icon;
    }

    updateAuthorComments() {
        this.authorComments.clear();

        // Get all comments
        const comments = document.querySelectorAll('.athing.comtr');

        // Count comments by author and the author comments elements by author
        comments.forEach(comment => {

            // save the author comments mapping (comments from each user in this post)
            const authorElement = comment.querySelector('.hnuser');
            if (authorElement) {
                const author = authorElement.textContent;

                if (!this.authorComments.has(author)) {
                    this.authorComments.set(author, []);
                }
                this.authorComments.get(author).push(comment);
            }
        });

        comments.forEach(comment => {
            this.injectAuthorCommentsNavigation(comment);

            this.overrideHNDefaultNavigation(comment);
        });
    }

    injectAuthorCommentsNavigation(comment) {
        const authorElement = comment.querySelector('.hnuser');
        if (authorElement && !authorElement.querySelector('.comment-count')) {
            const author = authorElement.textContent;
            const count = this.authorComments.get(author).length;

            const container = document.createElement('span');

            const countSpan = document.createElement('span');
            countSpan.className = 'comment-count';
            countSpan.textContent = `(${count})`;
            container.appendChild(countSpan);

            const navPrev = document.createElement('span');
            navPrev.className = 'author-nav nav-triangle';
            navPrev.textContent = '\u23F4';  // Unicode for left arrow '◀'
            navPrev.title = 'Go to previous comment by this author';
            navPrev.onclick = (e) => {
                e.preventDefault();
                this.navigateAuthorComments(author, comment, 'prev');
            };
            container.appendChild(navPrev);

            const navNext = document.createElement('span');
            navNext.className = 'author-nav nav-triangle';
            navNext.textContent = '\u23F5';   // Unicode for right arrow '▶'
            navNext.title = 'Go to next comment by this author';
            navNext.onclick = (e) => {
                e.preventDefault();
                this.navigateAuthorComments(author, comment, 'next');
            };
            container.appendChild(navNext);

            if (author === this.postAuthor) {
                const authorIndicator = document.createElement('span');
                authorIndicator.className = 'post-author';
                authorIndicator.textContent = '👑';
                authorIndicator.title = 'Post Author';
                container.appendChild(authorIndicator);
            }

            const separator = document.createElement("span");
            separator.className = "author-separator";
            separator.textContent = "|";
            container.appendChild(separator);

            // Get the parent element of the author element and append the container as second child
            authorElement.parentElement.insertBefore(container, authorElement.parentElement.children[1]);

            // Insert summarize comment link
            const navsElement = comment.querySelector('.navs');
            if(!navsElement) {
                console.error('Could not find the navs element to inject the summarize link');
                return;
            }

            navsElement.appendChild(document.createTextNode(' | '));

            const summarizeThreadLink = document.createElement('a');
            summarizeThreadLink.href = '#';
            summarizeThreadLink.textContent = 'summarize thread';
            summarizeThreadLink.title = 'Summarize all child comments in this thread';

            summarizeThreadLink.addEventListener('click', async (e) => {
                e.preventDefault();

                // Clicking the link should set the current comment state
                this.setCurrentComment(comment);

                // Get the item id from the 'age' link that shows '10 hours ago' or similar
                const itemLinkElement = comment.querySelector('.age')?.getElementsByTagName('a')[0];
                if (!itemLinkElement) {
                    console.error('Could not find the item link element to get the item id for summarization');
                    return;
                }

                const itemId = itemLinkElement.href.split('=')[1];
                const {formattedComment, commentPathToIdMap} = await this.getHNThread(itemId);
                if (!formattedComment) {
                    console.error('Could not get the thread for summarization');
                    return;
                }

                const commentDepth = commentPathToIdMap.size;
                const {aiProvider, model} = await this.getAIProviderModel();
                const shouldSummarize = this.shouldSummarizeText(formattedComment, commentDepth, aiProvider);

                if (!shouldSummarize) {
                    this.summaryPanel.updateContent({
                        title: 'Thread Too Brief for Summary',
                        metadata: `Thread: ${author} and child comments`,
                        text: `This conversation thread is concise enough to read directly. Summarizing short threads with a remote AI service would be inefficient. <br/><br/>
                                      However, if you still want to summarize it, you can <a href="#" id="options-page-link">configure a local AI provider</a> 
                                      like <a href="https://developer.chrome.com/docs/ai/built-in" target="_blank">Chrome Built-in AI</a> or 
                                      <a href="https://ollama.com/" target="_blank">Ollama</a> for more efficient processing of shorter threads.`
                    });

                    const optionsLink = this.summaryPanel.panel.querySelector('#options-page-link');
                    if (optionsLink) {
                        optionsLink.addEventListener('click', (e) => {
                            e.preventDefault();
                            this.openOptionsPage();
                        });
                    }
                    return;
                }

                const modelInfo = aiProvider ? ` using <strong>${aiProvider} ${model || ''}</strong>` : '';
                const highlightedAuthor = `<span class="highlight-author">${author}</span>`;
                const metadata = `Analyzing discussion by ${highlightedAuthor} and all replies`;

                this.summaryPanel.updateContent({
                    title: 'Thread Summary',
                    metadata: metadata,
                    text: `Generating summary${modelInfo}... This may take a few moments.`
                });

                this.summarizeTextWithAI(formattedComment, commentPathToIdMap);
            });

            navsElement.appendChild(summarizeThreadLink);
        }
    }

    shouldSummarizeText(formattedText, commentDepth, aiProvider) {

        // Ollama can handle larger data, so summarize longer threads and deeper comments
        if (aiProvider === 'ollama') {
            return true;
        }

        // Chrome Built-in AI cannot handle a lot of data, so limit the summarization to a certain depth
        if (aiProvider === 'chrome-ai') {
            return commentDepth <= 5;
        }

        // OpenAI and Claude can handle larger data, but it is expensive, so there should be a minimum length and depth
        const minSentenceLength = 8;
        const minCommentDepth = 3;

        const sentences = formattedText.split(/[.!?]+(?:\s+|$)/)
            .filter(sentence => sentence.trim().length > 0);

        // console.log('sentences:', sentences.length, 'depth:', commentDepth, 'shouldSummarize result: ', sentences.length > minSentenceLength && commentDepth > maxDepth);
        return sentences.length > minSentenceLength && commentDepth > minCommentDepth;
    }

    overrideHNDefaultNavigation(comment) {
        const hyperLinks = comment.querySelectorAll('.comhead .navs a');
        if (!hyperLinks) return;

        // Find the <a href> with text that have a hash ('#<comment_id>') and add click event listener
        const navLinks = Array.from(hyperLinks).filter(link => link.hash.length > 0);

        navLinks.forEach(link => {
            link.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation(); // stop the default link navigation

                const targetComment = this.getNavElementByName(comment, link.textContent.trim());
                if (targetComment) {
                    this.setCurrentComment(targetComment);
                }
            };
        });
    }

    navigateAuthorComments(author, currentComment, direction) {
        const comments = this.authorComments.get(author);
        if (!comments) return;

        const currentIndex = comments.indexOf(currentComment);
        if (currentIndex === -1) return;

        let targetIndex;
        if (direction === 'prev') {
            targetIndex = currentIndex > 0 ? currentIndex - 1 : comments.length - 1;
        } else {
            targetIndex = currentIndex < comments.length - 1 ? currentIndex + 1 : 0;
        }

        const targetComment = comments[targetIndex];
        this.setCurrentComment(targetComment);
    }

    setupUserHover() {
        document.querySelectorAll('.hnuser').forEach(authorElement => {
            authorElement.addEventListener('mouseenter', async (e) => {
                const username = e.target.textContent.replace(/[^a-zA-Z0-9_-]/g, '');
                const userInfo = await this.fetchUserInfo(username);

                if (userInfo) {
                    this.popup.innerHTML = `
            <strong>${username}</strong><br>
            Karma: ${userInfo.karma}<br>
            About: ${userInfo.about}
          `;

                    const rect = e.target.getBoundingClientRect();
                    this.popup.style.left = `${rect.left}px`;
                    this.popup.style.top = `${rect.bottom + window.scrollY + 5}px`;
                    this.popup.style.display = 'block';
                }
            });

            authorElement.addEventListener('mouseleave', () => {
                this.popup.style.display = 'none';
            });

            // Add event listener for Esc key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.popup.style.display = 'none';
                }
            });

            // Add event listener for clicks outside the popup
            document.addEventListener('click', (e) => {
                if (!this.popup.contains(e.target) && !e.target.classList.contains('hnuser')) {
                    this.popup.style.display = 'none';
                }
            });
        });
    }

    initSummarizationAI() {

        this.isAiAvailable = HNEnhancer.AI_AVAILABLE.NO;

        function parseAvailable(available) {
            switch (available) {
                case 'readily':
                    return HNEnhancer.AI_AVAILABLE.YES;
                case 'no':
                    return HNEnhancer.AI_AVAILABLE.NO;
                case 'after-download':
                    return HNEnhancer.AI_AVAILABLE.AFTER_DOWNLOAD;
            }
            return HNEnhancer.AI_AVAILABLE.NO;
        }


        // 1. Inject the script into the webpage's context
        const pageScript = document.createElement('script');
        pageScript.src = chrome.runtime.getURL('page-script.js');
        (document.head || document.documentElement).appendChild(pageScript);

        pageScript.onload = () => {
            window.postMessage({
                type: 'HN_CHECK_AI_AVAILABLE',
                data: {}
            });
        }

        // 2. Listen for messages from the webpage
        window.addEventListener('message', function (event) {
            // reject all messages from other domains
            if (event.origin !== window.location.origin) {
                return;
            }

            // console.log('content.js - Received message:', event.type, JSON.stringify(event.data));

            // Handle different message types
            switch (event.data.type) {
                case 'HN_CHECK_AI_AVAILABLE_RESPONSE':
                    const available = event.data.data.available;

                    // TODO: Find a better way to set the HNEnhancer instance
                    document.hnEnhancer.isAiAvailable = parseAvailable(available);
                    // console.log('Message from page script Chrome Built-in AI. HN_CHECK_AI_AVAILABLE_RESPONSE: ', document.hnEnhancer.isAiAvailable);
                    break;
                case 'HN_CHECK_AI_READY':
                    break;
                case 'HN_AI_SUMMARIZE_RESPONSE':
                    const summary = event.data.data.summary;
                    document.hnEnhancer.summaryPanel.updateContent({
                        text: summary
                    });
                    break;
            }
        });
    }

    addSummarizeCommentsLink() {
        const navLinks = document.querySelector('.subtext .subline');
        if (navLinks) {
            const summarizeLink = document.createElement('a');
            summarizeLink.href = '#';
            summarizeLink.textContent = 'summarize all comments';

            summarizeLink.addEventListener('click', (e) => this.handleSummarizeAllCommentsClick(e));

            navLinks.appendChild(document.createTextNode(' | '));
            navLinks.appendChild(summarizeLink);
        }
    }

    async getAIProviderModel() {
        const settingsData = await chrome.storage.sync.get('settings');
        const aiProvider = settingsData.settings?.providerSelection;
        const model = settingsData.settings?.[aiProvider]?.model;
        return {aiProvider, model};
    }

    async handleSummarizeAllCommentsClick(e) {
        e.preventDefault();
        const itemId = this.getCurrentHNItemId();
        if (!itemId) {
            return;
        }
        try {
            if (!this.summaryPanel.isVisible) {
                this.summaryPanel.toggle();
            }
            const {formattedComment, commentPathToIdMap} = await this.getHNThread(itemId);

            const {aiProvider, model} = await this.getAIProviderModel();
            if (aiProvider && model) {

                const postTitle = this.getHNPostTitle();
                const modelInfo = aiProvider ? ` using <strong>${aiProvider} ${model || ''}</strong>` : '';

                this.summaryPanel.updateContent({
                    title: 'Post Summary',
                    metadata: `Analyzing all threads in <strong>${postTitle}</strong>`,
                    text: `Generating comprehensive summary${modelInfo}... This may take a few moments.`
                });

                this.summarizeTextWithAI(formattedComment, commentPathToIdMap);
            }
        } catch (error) {
            console.error('Error fetching thread:', error);
            this.summaryPanel.updateContent({
                title: 'Error',
                metadata: '',
                text: 'Failed to fetch thread content'
            });
        }
    }

    getCurrentHNItemId() {
        const itemIdMatch = window.location.search.match(/id=(\d+)/);
        return itemIdMatch ? itemIdMatch[1] : null;
    }

    async getHNThread(itemId) {
        try {
            const response = await fetch(`https://hn.algolia.com/api/v1/items/${itemId}`);
            if (!response.ok) {
                // noinspection ExceptionCaughtLocallyJS
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
            const jsonData = await response.json();
            return this.convertToPathFormat(jsonData);
        } catch (error) {
            throw new Error(`Error fetching HN thread: ${error.message}`);
        }
    }

    convertToPathFormat(thread) {
        const result = [];
        const commentPathToIdMap = new Map();

        function decodeHTMLEntities(text) {
            const textarea = document.createElement('textarea');
            textarea.innerHTML = text;
            return textarea.value;
        }

        function processNode(node, parentPath = "") {
            const currentPath = parentPath ? parentPath : "1";

            let content = "";

            if (node) {
                content = node.title || node.text || "";
                if (content === null || content === undefined) {
                    content = "";
                } else {
                    content = decodeHTMLEntities(content);
                }
                commentPathToIdMap.set(currentPath, node.id);
                result.push(`[${currentPath}] ${node ? node.author : "unknown"}: ${content}`);

                if (node.children && node.children.length > 0) {
                    node.children.forEach((child, index) => {
                        const childPath = `${currentPath}.${index + 1}`;
                        processNode(child, childPath);
                    });
                }
            }
        }

        processNode(thread);
        return {
            formattedComment: result.join('\n'),
            commentPathToIdMap: commentPathToIdMap
        };
    }

    openOptionsPage() {
        chrome.runtime.sendMessage({
            type: 'HN_SHOW_OPTIONS',
            data: {}
        });
    }

    summarizeTextWithAI(formattedComment, commentPathToIdMap) {
        chrome.storage.sync.get('settings').then(data => {

            const providerSelection = data.settings?.providerSelection;
            // const providerSelection = 'none';
            const model = data.settings?.[providerSelection]?.model;

            if (!providerSelection ) {
                console.log('Missing AI summarization configuration');

                const message = 'To use the summarization feature, you need to configure an AI provider. <br/><br/>' +
                    'Please <a href="#" id="options-page-link">open the settings page</a> to select and configure your preferred AI provider ' +
                    '(OpenAI, Anthropic, <a href="https://ollama.com/" target="_blank">Ollama</a> or <a href="https://developer.chrome.com/docs/ai/built-in" target="_blank">Chrome Built-in AI</a>).';

                this.summaryPanel.updateContent({
                    title: 'AI Provider Setup Required',
                    text: message
                });

                // Add event listener after updating content
                const optionsLink = this.summaryPanel.panel.querySelector('#options-page-link');
                if (optionsLink) {
                    optionsLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.openOptionsPage();
                    });
                }
                return;
            }

            // console.log(`Summarizing text with AI: providerSelection: ${providerSelection} model: ${model}`);
            // console.log('1. Formatted comment:', formattedComment);

            switch (providerSelection) {
                case 'chrome-ai':
                    window.postMessage({
                        type: 'HN_AI_SUMMARIZE',
                        data: {text: formattedComment}
                    });
                    break;

                case 'openai':
                    const apiKey = data.settings?.[providerSelection]?.apiKey;
                    this.summarizeUsingOpenAI(formattedComment,  model, apiKey, commentPathToIdMap);
                    break;

                case 'anthropic':
                    const claudeApiKey = data.settings?.[providerSelection]?.apiKey;
                    this.summarizeUsingAnthropic(formattedComment, model, claudeApiKey, commentPathToIdMap);
                    break;

                case 'ollama':
                    this.summarizeUsingOllama(formattedComment, model, commentPathToIdMap);
                    break;

                case 'none':
                    this.showSummaryInPanel(formattedComment, commentPathToIdMap);
                    break;
            }
        }).catch(error => {
            console.error('Error fetching settings:', error);
        });
    }

    summarizeUsingOpenAI(text, model, apiKey, commentPathToIdMap) {
        // Validate required parameters
        if (!text || !model || !apiKey) {
            console.error('Missing required parameters for OpenAI summarization');
            this.summaryPanel.updateContent({
                title: 'Error',
                text: 'Missing API configuration'
            });
            return;
        }

        // Set up the API request
        const endpoint = 'https://api.openai.com/v1/chat/completions';

        // Create the system and user prompts for better summarization
        const systemPrompt = this.getSystemMessage();
        // console.log('2. System prompt:', systemPrompt);

        const postTitle = this.getHNPostTitle()
        const userPrompt = this.getUserMessage(postTitle, text);
        // console.log('3. User prompt:', userPrompt);

        // OpenAI takes system and user messages as an array with role (system / user) and content
        const messages = [{
            role: "system",
            content: systemPrompt
        }, {
            role: "user",
            content: userPrompt
        }];

        // Prepare the request payload
        const payload = {
            model: model,
            messages: messages,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0
        };

        // Make the API request using Promise chains
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        }).then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
                });
            }
            return response.json();
        }).then(data => {
            const summary = data?.choices[0]?.message?.content;

            if (!summary) {
                throw new Error('No summary generated from API response');
            }
            // console.log('4. Summary:', summary);

            // Update the summary panel with the generated summary
            this.showSummaryInPanel(summary, commentPathToIdMap);

        }).catch(error => {
            console.error('Error in OpenAI summarization:', error);

            // Update the summary panel with an error message
            let errorMessage = 'Error generating summary. ';
            if (error.message.includes('API key')) {
                errorMessage += 'Please check your API key configuration.';
            } else if (error.message.includes('429')) {
                errorMessage += 'Rate limit exceeded. Please try again later.';
            } else {
                errorMessage += 'Please try again later.';
            }

            this.summaryPanel.updateContent({
                title: 'Error',
                text: errorMessage
            });
        });
    }

    summarizeUsingAnthropic(text, model, apiKey, commentPathToIdMap) {
        // Validate required parameters
        if (!text || !model || !apiKey) {
            console.error('Missing required parameters for Anthropic summarization');
            this.summaryPanel.updateContent({
                title: 'Error',
                text: 'Missing API configuration'
            });
            return;
        }

        // Set up the API request
        const endpoint = 'https://api.anthropic.com/v1/messages';

        // Create the system and user prompts for better summarization
        const systemPrompt = this.getSystemMessage();
        // console.log('2. System prompt:', systemPrompt);

        const postTitle = this.getHNPostTitle()
        const userPrompt = this.getUserMessage(postTitle, text);
        // console.log('3. User prompt:', userPrompt);

        // Anthropic takes system messages at the top level, whereas user messages as an array with role "user" and content.
        const messages = [{
            role: "user",
            content: userPrompt
        }];

        // Prepare the request payload
        const payload = {
            model: model,
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages
        };

        // Make the API request using Promise chains
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true' // this is required to resolve CORS issue
            },
            body: JSON.stringify(payload)
        }).then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(`Anthropic API error: ${errorData.error?.message || 'Unknown error'}`);
                });
            }
            return response.json();
        }).then(data => {
            if(!data || !data.content || data.content.length === 0) {
                throw new Error(`Summary response data is empty. ${data}`);
            }
            const summary = data?.content[0]?.text;

            if (!summary) {
                throw new Error('No summary generated from API response');
            }
            // console.log('4. Summary:', summary);

            // Update the summary panel with the generated summary
            this.showSummaryInPanel(summary, commentPathToIdMap);

        }).catch(error => {
            console.error('Error in Anthropic summarization:', error);

            // Update the summary panel with an error message
            let errorMessage = 'Error generating summary. ';
            if (error.message.includes('API key')) {
                errorMessage += 'Please check your API key configuration.';
            } else if (error.message.includes('429')) {
                errorMessage += 'Rate limit exceeded. Please try again later.';
            } else {
                errorMessage += 'Please try again later.';
            }

            this.summaryPanel.updateContent({
                title: 'Error',
                text: errorMessage
            });
        });
    }

    getSystemMessage() {
        return `You are an AI assistant specialized in summarizing Hacker News discussions. Your task is to provide concise, meaningful summaries that capture the essence of the thread without losing important details. Follow these guidelines:
1. Identify and highlight the main topics and key arguments.
2. Capture diverse viewpoints and notable opinions.
3. Analyze the hierarchical structure of the conversation, paying close attention to the path numbers (e.g., [1], [1.1], [1.1.1]) to track reply relationships.
4. Note where significant conversation shifts occur.
5. Include brief, relevant quotes to support main points.
6. Maintain a neutral, objective tone.
7. Aim for a summary length of 150-300 words, adjusting based on thread complexity.

Input Format:
The conversation will be provided as text with path-based identifiers showing the hierarchical structure of the comments: [path_id] Author: Comment

Example:
[1] author1: First reply to the post
[1.1] author2: First reply to [1]
[1.1.1] author3: Second-level reply to [1.1]
[1.2] author4: Second reply to [1]

Your output should be well-structured, informative, and easily digestible for someone who hasn't read the original thread. Use markdown formatting for clarity and readability.`;
    }

    getUserMessage(title, text) {
        return `Analyze and summarize the following Hacker News thread. The title of the post and comments are separated by dashed lines.:
-----
Post Title: ${title}
-----
Comments: 
${text}
-----

Use the following structure as an example of the output (do not copy the content, only use the format). 
Add more sections as needed based on the content of the discussion while maintaining a clear and concise summary. If you add new sections, format them as markdown headers (e.g., ## New Section). If you add 'Notable Quotes' sections, the quotes should be enclosed in italics and should have path-based identifiers of the quoted comment.

# Summary
## Main discussion points
[List the main topics discussed across all branches as a list]
  1. [Topic 1]
  2. [Topic 2]
  3. [Topic 3]
  
## Key takeaways
[Summarize the most important insights or conclusions from the entire discussion]
  1. [Takeaway 1]
  2. [Takeaway 2]
  
# Thread analysis
## Primary branches
[Number and brief description of main conversation branches. For each significant branch, specify the branch path and evaluate its productivity or engagement level.]
  - [Branch 1 path]: [ Summary]. [Evaluation of branch effectiveness]
  - [Branch 2 path]: [Evaluation]
  
## Interaction patterns
[Notable patterns in how the discussion branched and evolved]

Please proceed with your analysis and summary of the Hacker News discussion.`;
    }

    // Show the summary in the summary panel - format the summary for two steps:
    // 1. Replace markdown with HTML
    // 2. Replace path identifiers with comment IDs
    async showSummaryInPanel(summary, commentPathToIdMap) {

        // Format the summary to replace markdown with HTML
        const summaryHtml = this.convertMarkdownToHTML(summary);

        // Parse the summaryHTML to find 'path' identifiers and replace them with the actual comment IDs links
        const formattedSummary = this.replacePathsWithCommentLinks(summaryHtml, commentPathToIdMap);

        const {aiProvider, model} = await this.getAIProviderModel();
        if (aiProvider && model) {
            this.summaryPanel.updateContent({
                metadata: `Summarized using <strong>${aiProvider} ${model}</strong>`,
                text: formattedSummary
            });
        } else {
            this.summaryPanel.updateContent({
                text: formattedSummary
            });
        }

        // Now that the summary links are in the DOM< attach listeners to those hyperlinks to navigate to the respective comments
        document.querySelectorAll('[data-comment-link="true"]').forEach(link => {

            link.addEventListener('click', (e) => {
                e.preventDefault();
                const id = link.dataset.commentId;
                const comment = document.getElementById(id);
                if(comment) {
                    this.setCurrentComment(comment);
                } else {
                    console.error('Failed to find DOM element for comment id:', id);
                }
            });
        });
    }

    replacePathsWithCommentLinks(text, commentPathToIdMap) {
        // Regular expression to match bracketed numbers with dots
        // Matches patterns like [1], [1.1], [1.1.2], etc.
        const pathRegex = /\[(\d+(?:\.\d+)*)]/g;

        // Replace each match with an HTML link
        return text.replace(pathRegex, (match, path) => {
            const id = commentPathToIdMap.get(path);
            if (!id) {
                return match; // If no ID found, return original text
            }
            return ` <a href="#" 
                       title="Go to comment #${id}"
                       data-comment-link="true" data-comment-id="${id}" 
                       style="color: rgb(130, 130, 130); text-decoration: underline;"
                    >comment #${id}</a>`;
        });
    }

    summarizeUsingOllama(text, model, commentPathToIdMap) {
        // Validate required parameters
        if (!text || !model) {
            console.error('Missing required parameters for Ollama summarization');
            this.summaryPanel.updateContent({
                title: 'Error',
                text: 'Missing API configuration'
            });
            return;
        }

        // Set up the API request
        const endpoint = 'http://localhost:11434/api/generate';

        // Create the system message for better summarization
        const systemMessage = `You are an AI assistant specialized in summarizing Hacker News discussions. Your task is to provide concise, meaningful summaries that capture the essence of the thread without losing important details. Follow these guidelines:
        1. Identify the main topics and key arguments. 
        2. Use markdown formatting for clarity and readability.
        3. Include brief, relevant quotes to support main points.
        4. Whenever you use a quote, provide the path-based identifier of the quoted comment.
        5. Show content hierarchy by using path-based identifiers (e.g., [1], [1.1], [1.1.1]) to track reply relationships.
        `;

        // Create the user message with the text to summarize
        const title = this.getHNPostTitle();
        const userMessage = `
Analyze and summarize the following Hacker News thread. The title of the post and comments are separated by dashed lines.:
-----
Post Title: ${title}
-----
Comments: 
${text}
-----

Use the following structure as an example of the output (do not copy the content, only use the format). The text in square brackets are placeholders for actual content. Do not show that in the final summary. Add more sections as needed based on the content of the discussion while maintaining a clear and concise summary. 

# Summary
## Main discussion points
[List the main topics discussed across all branches as a list]
  
## Key takeaways
[Summarize the most important insights or conclusions from the entire discussion as a list]

# Thread analysis
## Primary branches
[Number and brief description of main conversation branches as a list. For each significant branch, specify the branch path and evaluate its productivity or engagement level.]
  
## Interaction patterns
[Notable patterns in how the discussion branched and evolved]

## Notable Quotes
[Add notable quotes from the discussion with path-based identifiers of the quoted comment. Enclose quotes in italics.]

Please proceed with your analysis and summary of the Hacker News discussion.
        `;

        // console.log('2. System message:', systemMessage);
        // console.log('3. User message:', userMessage);

        // console.log('Ollama input text:', text);

        // Prepare the request payload
        const payload = {
            model: model,
            system: systemMessage,
            prompt: userMessage,
            stream: false
        };

        // Make the API request using Promise chains
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        }).then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(`Ollama API error: ${errorData.error?.message || 'Unknown error'}`);
                });
            }
            return response.json();
        }).then(data => {
            const summary = data.response;

            if (!summary) {
                throw new Error('No summary generated from API response');
            }
            // console.log('4. Summary:', summary);

            // Update the summary panel with the generated summary
            // TODO: Get the comment metadata here and pass it to the summary panel
            this.showSummaryInPanel(summary, commentPathToIdMap);

        }).catch(error => {
            console.error('Error in Ollama summarization:', error);

            // Update the summary panel with an error message
            let errorMessage = 'Error generating summary. ' + error.message;
            this.summaryPanel.updateContent({
                title: 'Error',
                text: errorMessage
            });
        });
    }

    initHomePageNavigation() {
        const posts = document.querySelectorAll('.athing');
        if (posts.length === 0) return;

        let currentPostIndex = 0;
        this.setCurrentPost(posts[currentPostIndex]);

        document.addEventListener('keydown', (e) => {
            if (e.target.matches('input, textarea, [contenteditable="true"]')) return;

            switch (e.key) {
                case 'j':
                    e.preventDefault();
                    if (currentPostIndex < posts.length - 1) {
                        currentPostIndex++;
                        this.setCurrentPost(posts[currentPostIndex]);
                    }
                    break;
                case 'k':
                    e.preventDefault();
                    if (currentPostIndex > 0) {
                        currentPostIndex--;
                        this.setCurrentPost(posts[currentPostIndex]);
                    }
                    break;
                case 'o':
                    e.preventDefault();
                    const postLink = posts[currentPostIndex].querySelector('.titleline a');
                    if (postLink) {
                        window.open(postLink.href, '_blank');
                    }
                    break;
                case 'c':
                    e.preventDefault();
                    if(!posts[currentPostIndex])
                        return;

                    const subtext = posts[currentPostIndex].nextElementSibling;
                    if (subtext) {
                        const commentsLink = subtext.querySelector('a[href^="item?id="]');
                        if (commentsLink) {
                            window.location.href = commentsLink.href;
                        }
                    }

                    break;
            }
        });

        this.setupGlobalKeyboardShortcuts();
    }

    setCurrentPost(post) {
        document.querySelectorAll('.athing').forEach(p => p.classList.remove('highlight-post'));
        post.classList.add('highlight-post');
        post.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    setupGlobalKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.matches('input, textarea, [contenteditable="true"]')) return;

            switch (e.key) {
                case '?':
                case '/':
                    e.preventDefault();
                    this.toggleHelpModal(this.helpModal.style.display === 'none');
                    break;
                case 'Escape':
                    if (this.helpModal.style.display === 'flex') {
                        e.preventDefault();
                        this.toggleHelpModal(false);
                    }
                    break;
            }
        });
    }

    getHNPostTitle() {
        if (!this.isCommentsPage) {
            return '';
        }
        return document.title;
    }

}

// Initialize the HNEnhancer. Note that we are loading this content script with the default run_at of 'document_idle'.
// So this script is injected only after the DOM is loaded and all other scripts have finished executing.
// This guarantees that the DOM of the main HN page is loaded by the time this script runs.
document.hnEnhancer = new HNEnhancer();
