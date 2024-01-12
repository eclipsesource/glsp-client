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

import { Action, RequestAction, ResponseAction, hasStringProp } from '@eclipse-glsp/protocol';

export interface AiAssistantRequestAction extends RequestAction<AiAssistantResponseAction> {
    kind: typeof AiAssistantRequestAction.KIND;
    message: string;
}

export namespace AiAssistantRequestAction {
    export const KIND = 'ai-assistant-request';

    export function is(object: unknown): object is AiAssistantRequestAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'message');
    }

    export function create(message: string, options: { requestId?: string } = {}): AiAssistantRequestAction {
        return {
            kind: KIND,
            requestId: '',
            message,
            ...options
        };
    }
}

export interface AiAssistantResponseAction extends ResponseAction {
    kind: typeof AiAssistantResponseAction.KIND;
    message: string;
}

export namespace AiAssistantResponseAction {
    export const KIND = 'ai-assistant-response';

    export function is(object: unknown): object is AiAssistantRequestAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'message');
    }

    export function create(message: string, options: { responseId?: string } = {}): AiAssistantResponseAction {
        return {
            kind: KIND,
            responseId: '',
            message,
            ...options
        };
    }
}

export interface AiAssistantCancelAction extends Action {
    kind: typeof AiAssistantCancelAction.KIND;
}

export namespace AiAssistantCancelAction {
    export const KIND = 'ai-assistant-cancel';

    export function is(object: unknown): object is AiAssistantCancelAction {
        return Action.hasKind(object, KIND);
    }

    export function create(): AiAssistantCancelAction {
        return {
            kind: KIND
        };
    }
}
