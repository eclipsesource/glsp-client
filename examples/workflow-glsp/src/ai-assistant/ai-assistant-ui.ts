/********************************************************************************
 * Copyright (c) 2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
import {
    AbstractUIExtension,
    Action,
    EditorContextService,
    GLSPActionDispatcher,
    IActionHandler,
    ICommand,
    IDiagramStartup,
    MaybePromise,
    TYPES
} from '@eclipse-glsp/client';
import { inject, injectable } from 'inversify';
import { Converter } from 'showdown';
import '../../css/ai-assistant.css';
import { AiAssistantCancelAction, AiAssistantRequestAction, AiAssistantResponseAction } from './actions';

@injectable()
export class AiAssistantUi extends AbstractUIExtension implements IDiagramStartup, IActionHandler {
    static readonly ID = 'ai-assistant-ui';
    protected static readonly SEND_BUTTON_CLASS = 'sendButton';
    protected static readonly SEND_ICON =
        '<svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"></path></svg>';
    protected static readonly STOP_ICON =
        '<svg viewBox="0 0 24 24" width="24" height="24" fill="white"><rect x="4" y="4" width="16" height="16"></rect></svg>';

    @inject(EditorContextService)
    protected editorContext: EditorContextService;

    @inject(TYPES.IActionDispatcher)
    protected actionDispatcher: GLSPActionDispatcher;

    protected mdConverter = new Converter();

    protected messageInput: HTMLInputElement;
    protected sendButton: HTMLButtonElement;
    protected chatBox: HTMLDivElement;
    protected isWaitingForResponse: boolean = false;

    id(): string {
        return AiAssistantUi.ID;
    }
    containerClass(): string {
        return AiAssistantUi.ID;
    }

    protected initializeContents(containerElement: HTMLElement): void {
        this.chatBox = document.createElement('div');
        this.chatBox.className += 'chatBox';
        this.addAssistantMessage(
            `I can answer questions about the diagram, apply changes, such as creating, deleting, renaming,
            or moving elements, and I can help you with validation errors. How can I help you today?`
        );

        const inputContainer = document.createElement('div');
        inputContainer.className += 'messageInputContainer';

        this.messageInput = document.createElement('input');
        this.messageInput.placeholder = 'Enter your request to the diagram assistant';
        this.messageInput.type = 'text';
        this.messageInput.className += 'messageInput';
        this.messageInput.addEventListener('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.sendMessageToAssistant();
            }
        });

        this.sendButton = document.createElement('button');
        this.sendButton.innerHTML = AiAssistantUi.SEND_ICON;
        this.sendButton.className = AiAssistantUi.SEND_BUTTON_CLASS;
        this.sendButton.onclick = _ => this.handleButtonClick();

        inputContainer.appendChild(this.messageInput);
        inputContainer.appendChild(this.sendButton);
        containerElement.appendChild(inputContainer);
        containerElement.appendChild(this.chatBox);
    }

    protected handleButtonClick(): void {
        if (this.isWaitingForResponse) {
            this.cancelRequest();
        } else {
            this.sendMessageToAssistant();
        }
    }

    protected sendMessageToAssistant(): void {
        const message = this.messageInput.value.trim();
        if (message) {
            this.messageInput.value = '';
            this.addUserMessage(message);
            this.setWaiting();
            this.actionDispatcher.request(AiAssistantRequestAction.create(message)).then(
                result => {
                    this.addAssistantMessage(result.message);
                    this.unsetWaiting();
                },
                (reason: string) => {
                    this.addAssistantMessage(reason);
                    this.unsetWaiting();
                }
            );
            this.messageInput.focus();
        }
    }

    protected addAssistantMessage(message: string): void {
        this.addMessage('Assistant', message);
    }

    protected addUserMessage(message: string): void {
        this.addMessage('You', message);
    }

    protected addMessage(userName: string, message: string): void {
        this.chatBox.innerHTML += `
            <div class="message">
                <h3 class="${userName} message-label">${userName}</h3>
                ${this.messageToHtml(message)}
            </div>
        `;
        this.chatBox.scrollTop = this.chatBox.scrollHeight;
    }

    protected messageToHtml(message: string): string {
        return this.mdConverter.makeHtml(message);
    }

    protected cancelRequest(): void {
        this.actionDispatcher.dispatch(AiAssistantCancelAction.create());
        this.unsetWaiting();
    }

    protected setWaiting(): void {
        this.containerElement.classList.add('loading');
        this.sendButton.innerHTML = AiAssistantUi.STOP_ICON;
        this.sendButton.className = `${AiAssistantUi.SEND_BUTTON_CLASS} waiting`;
        this.isWaitingForResponse = true;
    }

    protected unsetWaiting(): void {
        this.containerElement.classList.remove('loading');
        this.sendButton.innerHTML = AiAssistantUi.SEND_ICON;
        this.sendButton.className = `${AiAssistantUi.SEND_BUTTON_CLASS}`;
        this.isWaitingForResponse = false;
    }

    handle(action: Action): void | Action | ICommand {
        if (AiAssistantResponseAction.is(action)) {
            this.addAssistantMessage(action.message);
        }
    }

    postModelInitialization(): MaybePromise<void> {
        this.show(this.editorContext.modelRoot);
    }
}
